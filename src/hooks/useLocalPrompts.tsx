import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabase, saveDatabase, generateId } from '@/lib/database';
import { useToast } from './use-toast';
import { DEFAULT_TAG_COLOR } from '@/constants';
import type { 
  Prompt, 
  PromptVersion, 
  Tag, 
  ChatMessage, 
  ChatExample, 
  VersionAnnotation, 
  PromptUsageData,
  SkillFile,
} from '@/types';

// Re-export types for backward compatibility
export type { Prompt, PromptVersion, Tag, ChatMessage, ChatExample, VersionAnnotation, SkillFile };
export type PromptUsage = PromptUsageData;

export function usePrompts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const promptsQuery = useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      const db = await getDatabase();
      
      const promptsResult = db.exec('SELECT id, title, description, license, created_at, updated_at FROM prompts ORDER BY updated_at DESC');
      const versionsResult = db.exec('SELECT id, prompt_id, content, version_number, is_active, created_at FROM prompt_versions WHERE is_active = 1');
      const tagsResult = db.exec('SELECT id, name, color FROM tags');
      const promptTagsResult = db.exec('SELECT prompt_id, tag_id FROM prompt_tags');

      const prompts: Prompt[] = [];
      
      if (promptsResult.length > 0) {
        const promptCols = promptsResult[0].columns;
        const promptRows = promptsResult[0].values;
        
        const versions = versionsResult[0]?.values || [];
        const versionCols = versionsResult[0]?.columns || [];
        
        const allTags = tagsResult[0]?.values || [];
        const tagCols = tagsResult[0]?.columns || [];
        
        const promptTagLinks = promptTagsResult[0]?.values || [];

        for (const row of promptRows) {
          const prompt: Record<string, unknown> = {};
          promptCols.forEach((col, i) => {
            prompt[col] = row[i];
          });

          // Find active version
          const activeVersionRow = versions.find((v) => v[versionCols.indexOf('prompt_id')] === prompt.id);
          if (activeVersionRow) {
            prompt.active_version = {};
            versionCols.forEach((col, i) => {
              (prompt.active_version as Record<string, unknown>)[col] = activeVersionRow[i];
            });
            (prompt.active_version as Record<string, unknown>).is_active = Boolean((prompt.active_version as Record<string, unknown>).is_active);
          }

          // Find tags
          const tagIds = promptTagLinks
            .filter((pt) => pt[0] === prompt.id)
            .map((pt) => pt[1]);
          
          prompt.tags = allTags
            .filter((t) => tagIds.includes(t[tagCols.indexOf('id')]))
            .map((t) => {
              const tag: Record<string, unknown> = {};
              tagCols.forEach((col, i) => {
                tag[col] = t[i];
              });
              tag.color = tag.color || DEFAULT_TAG_COLOR;
              return tag;
            });

          prompts.push(prompt as unknown as Prompt);
        }
      }

      return prompts;
    },
  });

  const createPromptMutation = useMutation({
    mutationFn: async ({ title, description, license, content, tagIds }: { title: string; description?: string; license?: string; content: string; tagIds?: string[] }) => {
      const db = await getDatabase();
      const promptId = generateId();
      const versionId = generateId();
      const now = new Date().toISOString();

      db.run('INSERT INTO prompts (id, title, description, license, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        promptId,
        title,
        description || '',
        license || '',
        now,
        now,
      ]);

      db.run(
        'INSERT INTO prompt_versions (id, prompt_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, promptId, content, 1, 1, now]
      );

      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          db.run('INSERT INTO prompt_tags (id, prompt_id, tag_id) VALUES (?, ?, ?)', [
            generateId(),
            promptId,
            tagId,
          ]);
        }
      }

      await saveDatabase();
      return { id: promptId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: 'Skill created' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({
      promptId,
      title,
      description,
      license,
      content,
      tagIds,
    }: {
      promptId: string;
      title: string;
      description?: string;
      license?: string;
      content: string;
      tagIds?: string[];
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      db.run('UPDATE prompts SET title = ?, description = ?, license = ?, updated_at = ? WHERE id = ?', [title, description || '', license || '', now, promptId]);

      // Get current active version ID for copying chat examples
      const activeVersionResult = db.exec(
        'SELECT id FROM prompt_versions WHERE prompt_id = ? AND is_active = 1',
        [promptId]
      );
      const previousVersionId = activeVersionResult[0]?.values[0]?.[0] as string | undefined;

      // Get current max version number
      const versionResult = db.exec(
        'SELECT MAX(version_number) as max_version FROM prompt_versions WHERE prompt_id = ?',
        [promptId]
      );
      const maxVersion = (versionResult[0]?.values[0]?.[0] as number) || 0;

      db.run('UPDATE prompt_versions SET is_active = 0 WHERE prompt_id = ?', [promptId]);

      // Create new version
      const versionId = generateId();
      db.run(
        'INSERT INTO prompt_versions (id, prompt_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, promptId, content, maxVersion + 1, 1, now]
      );

      // Copy user prompts from previous version's chat examples
      if (previousVersionId) {
        const chatExamplesResult = db.exec(
          'SELECT messages FROM chat_examples WHERE version_id = ?',
          [previousVersionId]
        );
        if (chatExamplesResult[0]?.values[0]) {
          const oldMessages = JSON.parse(chatExamplesResult[0].values[0][0] as string || '[]');
          let newMessages: unknown[] = [];
          if (oldMessages.length > 0 && 'userPrompt' in oldMessages[0]) {
            newMessages = oldMessages.map((ex: { userPrompt: string }) => ({
              userPrompt: ex.userPrompt,
              assistantResponse: '',
            }));
          }
          if (newMessages.length > 0) {
            db.run(
              'INSERT INTO chat_examples (id, version_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
              [generateId(), versionId, JSON.stringify(newMessages), now, now]
            );
          }
        }
      }

      // Update tags
      if (tagIds !== undefined) {
        db.run('DELETE FROM prompt_tags WHERE prompt_id = ?', [promptId]);
        for (const tagId of tagIds) {
          db.run('INSERT INTO prompt_tags (id, prompt_id, tag_id) VALUES (?, ?, ?)', [
            generateId(),
            promptId,
            tagId,
          ]);
        }
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-versions'] });
      queryClient.invalidateQueries({ queryKey: ['chat-examples'] });
      toast({ title: 'Nieuwe versie opgeslagen' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ promptId, tagIds }: { promptId: string; tagIds: string[] }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      db.run('DELETE FROM prompt_tags WHERE prompt_id = ?', [promptId]);
      for (const tagId of tagIds) {
        db.run('INSERT INTO prompt_tags (id, prompt_id, tag_id) VALUES (?, ?, ?)', [
          generateId(),
          promptId,
          tagId,
        ]);
      }

      db.run('UPDATE prompts SET updated_at = ? WHERE id = ?', [now, promptId]);

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: 'Tags bijgewerkt' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const db = await getDatabase();
      
      db.run('DELETE FROM prompt_tags WHERE prompt_id = ?', [promptId]);
      
      const versionsResult = db.exec('SELECT id FROM prompt_versions WHERE prompt_id = ?', [promptId]);
      if (versionsResult[0]?.values) {
        for (const row of versionsResult[0].values) {
          const versionId = row[0] as string;
          db.run('DELETE FROM version_annotations WHERE version_id = ?', [versionId]);
          db.run('DELETE FROM chat_examples WHERE version_id = ?', [versionId]);
        }
      }
      
      db.run('DELETE FROM prompt_versions WHERE prompt_id = ?', [promptId]);
      db.run('DELETE FROM prompts WHERE id = ?', [promptId]);
      
      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: 'Prompt verwijderd' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  return {
    prompts: promptsQuery.data || [],
    isLoading: promptsQuery.isLoading,
    createPrompt: createPromptMutation.mutateAsync,
    updatePrompt: updatePromptMutation.mutateAsync,
    updateTags: updateTagsMutation.mutateAsync,
    deletePrompt: deletePromptMutation.mutateAsync,
    isCreating: createPromptMutation.isPending,
    isUpdating: updatePromptMutation.isPending,
  };
}

export function usePromptVersions(promptId: string | undefined) {
  return useQuery({
    queryKey: ['prompt-versions', promptId],
    queryFn: async () => {
      if (!promptId) return [];

      const db = await getDatabase();
      const result = db.exec(
        'SELECT id, prompt_id, content, version_number, is_active, created_at FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number DESC',
        [promptId]
      );

      if (!result[0]) return [];

      const cols = result[0].columns;
      return result[0].values.map((row) => {
        const version: Record<string, unknown> = {};
        cols.forEach((col, i) => {
          version[col] = row[i];
        });
        version.is_active = Boolean(version.is_active);
        return version as unknown as PromptVersion;
      });
    },
    enabled: !!promptId,
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ promptId, versionId }: { promptId: string; versionId: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      db.run('UPDATE prompt_versions SET is_active = 0 WHERE prompt_id = ?', [promptId]);
      db.run('UPDATE prompt_versions SET is_active = 1 WHERE id = ?', [versionId]);
      db.run('UPDATE prompts SET updated_at = ? WHERE id = ?', [now, promptId]);

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-versions'] });
      toast({ title: 'Versie hersteld' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });
}

export function useTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const db = await getDatabase();
      const result = db.exec('SELECT id, name, color FROM tags ORDER BY name');

      if (!result[0]) return [];

      const cols = result[0].columns;
      return result[0].values.map((row) => {
        const tag: Record<string, unknown> = {};
        cols.forEach((col, i) => {
          tag[col] = row[i];
        });
        tag.color = tag.color || DEFAULT_TAG_COLOR;
        return tag as unknown as Tag;
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async ({ name, color = DEFAULT_TAG_COLOR }: { name: string; color?: string }) => {
      const db = await getDatabase();
      const id = generateId();
      const now = new Date().toISOString();

      db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [id, name, color, now]);
      await saveDatabase();

      return { id, name, color } as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const db = await getDatabase();
      
      if (name !== undefined) {
        db.run('UPDATE tags SET name = ? WHERE id = ?', [name, id]);
      }
      if (color !== undefined) {
        db.run('UPDATE tags SET color = ? WHERE id = ?', [color, id]);
      }
      
      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: 'Tag bijgewerkt' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const db = await getDatabase();
      db.run('DELETE FROM prompt_tags WHERE tag_id = ?', [tagId]);
      db.run('DELETE FROM tags WHERE id = ?', [tagId]);
      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: 'Tag verwijderd' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  return {
    tags: tagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    createTag: createTagMutation.mutateAsync,
    updateTag: updateTagMutation.mutateAsync,
    deleteTag: deleteTagMutation.mutateAsync,
  };
}

export function useVersionAnnotations(versionId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const annotationsQuery = useQuery({
    queryKey: ['version-annotations', versionId],
    queryFn: async () => {
      if (!versionId) return null;

      const db = await getDatabase();
      const result = db.exec('SELECT id, version_id, note FROM version_annotations WHERE version_id = ?', [
        versionId,
      ]);

      if (!result[0]?.values[0]) return null;

      const cols = result[0].columns;
      const annotation: Record<string, unknown> = {};
      cols.forEach((col, i) => {
        annotation[col] = result[0].values[0][i];
      });
      return annotation as unknown as VersionAnnotation;
    },
    enabled: !!versionId,
  });

  const upsertAnnotationMutation = useMutation({
    mutationFn: async ({ versionId, note }: { versionId: string; note: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      const existing = db.exec('SELECT id FROM version_annotations WHERE version_id = ?', [versionId]);

      if (existing[0]?.values[0]) {
        db.run('UPDATE version_annotations SET note = ?, updated_at = ? WHERE version_id = ?', [
          note,
          now,
          versionId,
        ]);
      } else {
        db.run(
          'INSERT INTO version_annotations (id, version_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [generateId(), versionId, note, now, now]
        );
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['version-annotations'] });
      queryClient.invalidateQueries({ queryKey: ['all-version-annotations'] });
      toast({ title: 'Notitie opgeslagen' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  return {
    annotation: annotationsQuery.data,
    isLoading: annotationsQuery.isLoading,
    upsertAnnotation: upsertAnnotationMutation.mutateAsync,
  };
}

export function useChatExamples(versionId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const chatExamplesQuery = useQuery({
    queryKey: ['chat-examples', versionId],
    queryFn: async () => {
      if (!versionId) return null;

      const db = await getDatabase();
      const result = db.exec('SELECT id, version_id, messages FROM chat_examples WHERE version_id = ?', [
        versionId,
      ]);

      if (!result[0]?.values[0]) return null;

      const cols = result[0].columns;
      const chatExample: Record<string, unknown> = {};
      cols.forEach((col, i) => {
        chatExample[col] = result[0].values[0][i];
      });
      chatExample.messages = JSON.parse(chatExample.messages as string || '[]');
      return chatExample as unknown as ChatExample;
    },
    enabled: !!versionId,
  });

  const upsertChatExampleMutation = useMutation({
    mutationFn: async ({ versionId, messages }: { versionId: string; messages: ChatMessage[] }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const messagesJson = JSON.stringify(messages);

      const existing = db.exec('SELECT id FROM chat_examples WHERE version_id = ?', [versionId]);

      if (existing[0]?.values[0]) {
        db.run('UPDATE chat_examples SET messages = ?, updated_at = ? WHERE version_id = ?', [
          messagesJson,
          now,
          versionId,
        ]);
      } else {
        db.run(
          'INSERT INTO chat_examples (id, version_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [generateId(), versionId, messagesJson, now, now]
        );
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-examples'] });
      toast({ title: 'Chat-voorbeeld opgeslagen' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  return {
    chatExample: chatExamplesQuery.data,
    isLoading: chatExamplesQuery.isLoading,
    upsertChatExample: upsertChatExampleMutation.mutateAsync,
  };
}

export function usePromptUsage(promptId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const usageQuery = useQuery({
    queryKey: ['prompt-usage', promptId],
    queryFn: async () => {
      if (!promptId) return null;

      const db = await getDatabase();
      const result = db.exec('SELECT id, prompt_id, explanation FROM prompt_usage WHERE prompt_id = ?', [
        promptId,
      ]);

      if (!result[0]?.values[0]) return null;

      const cols = result[0].columns;
      const usage: Record<string, unknown> = {};
      cols.forEach((col, i) => {
        usage[col] = result[0].values[0][i];
      });
      return usage as unknown as PromptUsageData;
    },
    enabled: !!promptId,
  });

  const upsertUsageMutation = useMutation({
    mutationFn: async ({ promptId, explanation }: { promptId: string; explanation: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      const existing = db.exec('SELECT id FROM prompt_usage WHERE prompt_id = ?', [promptId]);

      if (existing[0]?.values[0]) {
        db.run('UPDATE prompt_usage SET explanation = ?, updated_at = ? WHERE prompt_id = ?', [
          explanation,
          now,
          promptId,
        ]);
      } else {
        db.run(
          'INSERT INTO prompt_usage (id, prompt_id, explanation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [generateId(), promptId, explanation, now, now]
        );
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-usage'] });
      toast({ title: 'Toelichting opgeslagen' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Fout', description: error.message });
    },
  });

  return {
    usage: usageQuery.data,
    isLoading: usageQuery.isLoading,
    upsertUsage: upsertUsageMutation.mutateAsync,
  };
}

export function useAllVersionAnnotations(promptId: string | undefined) {
  return useQuery({
    queryKey: ['all-version-annotations', promptId],
    queryFn: async () => {
      if (!promptId) return [];

      const db = await getDatabase();
      const result = db.exec(`
        SELECT va.id, va.version_id, va.note, va.created_at, pv.version_number 
        FROM version_annotations va
        JOIN prompt_versions pv ON pv.id = va.version_id
        WHERE pv.prompt_id = ?
        ORDER BY pv.version_number DESC
      `, [promptId]);

      if (!result[0]) return [];

      const cols = result[0].columns;
      return result[0].values.map((row) => {
        const annotation: Record<string, unknown> = {};
        cols.forEach((col, i) => {
          annotation[col] = row[i];
        });
        return annotation as unknown as VersionAnnotation;
      });
    },
    enabled: !!promptId,
  });
}

export function useVersionChatExamples(versionId: string | undefined) {
  return useQuery({
    queryKey: ['version-chat-examples', versionId],
    queryFn: async () => {
      if (!versionId) return null;

      const db = await getDatabase();
      const result = db.exec('SELECT id, version_id, messages FROM chat_examples WHERE version_id = ?', [
        versionId,
      ]);

      if (!result[0]?.values[0]) return null;

      const cols = result[0].columns;
      const chatExample: Record<string, unknown> = {};
      cols.forEach((col, i) => {
        chatExample[col] = result[0].values[0][i];
      });
      chatExample.messages = JSON.parse(chatExample.messages as string || '[]');
      return chatExample as unknown as ChatExample;
    },
    enabled: !!versionId,
  });
}

export function useSkillFiles(promptId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filesQuery = useQuery({
    queryKey: ['skill-files', promptId],
    queryFn: async () => {
      if (!promptId) return [];

      const db = await getDatabase();
      const result = db.exec(
        'SELECT id, prompt_id, filename, file_type, content, created_at, updated_at FROM skill_files WHERE prompt_id = ? ORDER BY file_type, filename',
        [promptId]
      );

      if (!result[0]) return [];

      const cols = result[0].columns;
      return result[0].values.map((row) => {
        const file: Record<string, unknown> = {};
        cols.forEach((col, i) => {
          file[col] = row[i];
        });
        return file as unknown as SkillFile;
      });
    },
    enabled: !!promptId,
  });

  const upsertFileMutation = useMutation({
    mutationFn: async ({
      promptId,
      filename,
      file_type,
      content,
      existingId,
    }: {
      promptId: string;
      filename: string;
      file_type: 'script' | 'reference';
      content: string;
      existingId?: string;
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      if (existingId) {
        db.run(
          'UPDATE skill_files SET filename = ?, file_type = ?, content = ?, updated_at = ? WHERE id = ?',
          [filename, file_type, content, now, existingId]
        );
      } else {
        const id = generateId();
        db.run(
          'INSERT INTO skill_files (id, prompt_id, filename, file_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, promptId, filename, file_type, content, now, now]
        );
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-files', promptId] });
      toast({ title: 'File saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const db = await getDatabase();
      db.run('DELETE FROM skill_files WHERE id = ?', [fileId]);
      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-files', promptId] });
      toast({ title: 'File deleted' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  return {
    files: filesQuery.data || [],
    isLoading: filesQuery.isLoading,
    upsertFile: upsertFileMutation.mutateAsync,
    deleteFile: deleteFileMutation.mutateAsync,
    isUpserting: upsertFileMutation.isPending,
    isDeleting: deleteFileMutation.isPending,
  };
}

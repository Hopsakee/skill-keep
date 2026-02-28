import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabase, saveDatabase, generateId } from '@/lib/database';
import { useToast } from './use-toast';
import { DEFAULT_TAG_COLOR } from '@/constants';
import type { 
  Skill, 
  SkillVersion, 
  Tag, 
  ChatMessage, 
  ChatExample, 
  VersionAnnotation, 
  SkillUsageData,
  SkillFile,
} from '@/types';

// Re-export types for convenience
export type { Skill, SkillVersion, Tag, ChatMessage, ChatExample, VersionAnnotation, SkillFile };
export type SkillUsage = SkillUsageData;

export function useSkills() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const skillsQuery = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const db = await getDatabase();
      
      const skillsResult = db.exec('SELECT id, title, description, license, created_at, updated_at FROM skills ORDER BY updated_at DESC');
      const versionsResult = db.exec('SELECT id, skill_id, content, version_number, is_active, created_at FROM skill_versions WHERE is_active = 1');
      const tagsResult = db.exec('SELECT id, name, color FROM tags');
      const skillTagsResult = db.exec('SELECT skill_id, tag_id FROM skill_tags');

      const skills: Skill[] = [];
      
      if (skillsResult.length > 0) {
        const skillCols = skillsResult[0].columns;
        const skillRows = skillsResult[0].values;
        
        const versions = versionsResult[0]?.values || [];
        const versionCols = versionsResult[0]?.columns || [];
        
        const allTags = tagsResult[0]?.values || [];
        const tagCols = tagsResult[0]?.columns || [];
        
        const skillTagLinks = skillTagsResult[0]?.values || [];

        for (const row of skillRows) {
          const skill: Record<string, unknown> = {};
          skillCols.forEach((col, i) => {
            skill[col] = row[i];
          });

          // Find active version
          const activeVersionRow = versions.find((v) => v[versionCols.indexOf('skill_id')] === skill.id);
          if (activeVersionRow) {
            skill.active_version = {};
            versionCols.forEach((col, i) => {
              (skill.active_version as Record<string, unknown>)[col] = activeVersionRow[i];
            });
            (skill.active_version as Record<string, unknown>).is_active = Boolean((skill.active_version as Record<string, unknown>).is_active);
          }

          // Find tags
          const tagIds = skillTagLinks
            .filter((st) => st[0] === skill.id)
            .map((st) => st[1]);
          
          skill.tags = allTags
            .filter((t) => tagIds.includes(t[tagCols.indexOf('id')]))
            .map((t) => {
              const tag: Record<string, unknown> = {};
              tagCols.forEach((col, i) => {
                tag[col] = t[i];
              });
              tag.color = tag.color || DEFAULT_TAG_COLOR;
              return tag;
            });

          skills.push(skill as unknown as Skill);
        }
      }

      return skills;
    },
  });

  const createSkillMutation = useMutation({
    mutationFn: async ({ title, description, license, content, tagIds }: { title: string; description?: string; license?: string; content: string; tagIds?: string[] }) => {
      const trimmedTitle = (title || '').trim();
      if (!trimmedTitle) throw new Error('Skill name is required');
      
      const db = await getDatabase();
      const skillId = generateId();
      const versionId = generateId();
      const now = new Date().toISOString();

      
      db.run('INSERT INTO skills (id, title, description, license, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        skillId,
        String(trimmedTitle),
        description || '',
        license || '',
        now,
        now,
      ]);

      db.run(
        'INSERT INTO skill_versions (id, skill_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, skillId, content, 1, 1, now]
      );

      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          db.run('INSERT INTO skill_tags (id, skill_id, tag_id) VALUES (?, ?, ?)', [
            generateId(),
            skillId,
            tagId,
          ]);
        }
      }

      await saveDatabase();
      return { id: skillId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({ title: 'Skill created' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: async ({
      skillId,
      title,
      description,
      license,
      content,
      tagIds,
    }: {
      skillId: string;
      title: string;
      description?: string;
      license?: string;
      content: string;
      tagIds?: string[];
    }) => {
      const db = await getDatabase();
      const trimmedTitle = (title || '').trim();
      if (!trimmedTitle) throw new Error('Skill name is required');
      const now = new Date().toISOString();

      db.run('UPDATE skills SET title = ?, description = ?, license = ?, updated_at = ? WHERE id = ?', [trimmedTitle, description || '', license || '', now, skillId]);

      // Get current active version ID for copying chat examples
      const activeVersionResult = db.exec(
        'SELECT id FROM skill_versions WHERE skill_id = ? AND is_active = 1',
        [skillId]
      );
      const previousVersionId = activeVersionResult[0]?.values[0]?.[0] as string | undefined;

      // Get current max version number
      const versionResult = db.exec(
        'SELECT MAX(version_number) as max_version FROM skill_versions WHERE skill_id = ?',
        [skillId]
      );
      const maxVersion = (versionResult[0]?.values[0]?.[0] as number) || 0;

      db.run('UPDATE skill_versions SET is_active = 0 WHERE skill_id = ?', [skillId]);

      // Create new version
      const versionId = generateId();
      db.run(
        'INSERT INTO skill_versions (id, skill_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, skillId, content, maxVersion + 1, 1, now]
      );

      // Copy user inputs from previous version's chat examples
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
        db.run('DELETE FROM skill_tags WHERE skill_id = ?', [skillId]);
        for (const tagId of tagIds) {
          db.run('INSERT INTO skill_tags (id, skill_id, tag_id) VALUES (?, ?, ?)', [
            generateId(),
            skillId,
            tagId,
          ]);
        }
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['skill-versions'] });
      queryClient.invalidateQueries({ queryKey: ['chat-examples'] });
      toast({ title: 'New version saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ skillId, tagIds }: { skillId: string; tagIds: string[] }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      db.run('DELETE FROM skill_tags WHERE skill_id = ?', [skillId]);
      for (const tagId of tagIds) {
        db.run('INSERT INTO skill_tags (id, skill_id, tag_id) VALUES (?, ?, ?)', [
          generateId(),
          skillId,
          tagId,
        ]);
      }

      db.run('UPDATE skills SET updated_at = ? WHERE id = ?', [now, skillId]);

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({ title: 'Tags updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      const db = await getDatabase();
      
      db.run('DELETE FROM skill_tags WHERE skill_id = ?', [skillId]);
      
      const versionsResult = db.exec('SELECT id FROM skill_versions WHERE skill_id = ?', [skillId]);
      if (versionsResult[0]?.values) {
        for (const row of versionsResult[0].values) {
          const versionId = row[0] as string;
          db.run('DELETE FROM version_annotations WHERE version_id = ?', [versionId]);
          db.run('DELETE FROM chat_examples WHERE version_id = ?', [versionId]);
        }
      }
      
      db.run('DELETE FROM skill_versions WHERE skill_id = ?', [skillId]);
      db.run('DELETE FROM skills WHERE id = ?', [skillId]);
      
      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({ title: 'Skill deleted' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  return {
    skills: skillsQuery.data || [],
    isLoading: skillsQuery.isLoading,
    createSkill: createSkillMutation.mutateAsync,
    updateSkill: updateSkillMutation.mutateAsync,
    updateTags: updateTagsMutation.mutateAsync,
    deleteSkill: deleteSkillMutation.mutateAsync,
    isCreating: createSkillMutation.isPending,
    isUpdating: updateSkillMutation.isPending,
  };
}


export function useSkillVersions(skillId: string | undefined) {
  return useQuery({
    queryKey: ['skill-versions', skillId],
    queryFn: async () => {
      if (!skillId) return [];

      const db = await getDatabase();
      const result = db.exec(
        'SELECT id, skill_id, content, version_number, is_active, created_at FROM skill_versions WHERE skill_id = ? ORDER BY version_number DESC',
        [skillId]
      );

      if (!result[0]) return [];

      const cols = result[0].columns;
      return result[0].values.map((row) => {
        const version: Record<string, unknown> = {};
        cols.forEach((col, i) => {
          version[col] = row[i];
        });
        version.is_active = Boolean(version.is_active);
        return version as unknown as SkillVersion;
      });
    },
    enabled: !!skillId,
  });
}


export function useRestoreVersion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ skillId, versionId }: { skillId: string; versionId: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      db.run('UPDATE skill_versions SET is_active = 0 WHERE skill_id = ?', [skillId]);
      db.run('UPDATE skill_versions SET is_active = 1 WHERE id = ?', [versionId]);
      db.run('UPDATE skills SET updated_at = ? WHERE id = ?', [now, skillId]);

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['skill-versions'] });
      toast({ title: 'Version restored' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({ title: 'Tag updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const db = await getDatabase();
      db.run('DELETE FROM skill_tags WHERE tag_id = ?', [tagId]);
      db.run('DELETE FROM tags WHERE id = ?', [tagId]);
      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({ title: 'Tag deleted' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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
      toast({ title: 'Note saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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
      toast({ title: 'Chat example saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  return {
    chatExample: chatExamplesQuery.data,
    isLoading: chatExamplesQuery.isLoading,
    upsertChatExample: upsertChatExampleMutation.mutateAsync,
  };
}

export function useSkillUsage(skillId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const usageQuery = useQuery({
    queryKey: ['skill-usage', skillId],
    queryFn: async () => {
      if (!skillId) return null;

      const db = await getDatabase();
      const result = db.exec('SELECT id, skill_id, explanation FROM skill_usage WHERE skill_id = ?', [
        skillId,
      ]);

      if (!result[0]?.values[0]) return null;

      const cols = result[0].columns;
      const usage: Record<string, unknown> = {};
      cols.forEach((col, i) => {
        usage[col] = result[0].values[0][i];
      });
      return usage as unknown as SkillUsageData;
    },
    enabled: !!skillId,
  });

  const upsertUsageMutation = useMutation({
    mutationFn: async ({ skillId, explanation }: { skillId: string; explanation: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      const existing = db.exec('SELECT id FROM skill_usage WHERE skill_id = ?', [skillId]);

      if (existing[0]?.values[0]) {
        db.run('UPDATE skill_usage SET explanation = ?, updated_at = ? WHERE skill_id = ?', [
          explanation,
          now,
          skillId,
        ]);
      } else {
        db.run(
          'INSERT INTO skill_usage (id, skill_id, explanation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [generateId(), skillId, explanation, now, now]
        );
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-usage'] });
      toast({ title: 'Usage notes saved' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  return {
    usage: usageQuery.data,
    isLoading: usageQuery.isLoading,
    upsertUsage: upsertUsageMutation.mutateAsync,
  };
}


export function useAllVersionAnnotations(skillId: string | undefined) {
  return useQuery({
    queryKey: ['all-version-annotations', skillId],
    queryFn: async () => {
      if (!skillId) return [];

      const db = await getDatabase();
      const result = db.exec(`
        SELECT va.id, va.version_id, va.note, va.created_at, sv.version_number 
        FROM version_annotations va
        JOIN skill_versions sv ON sv.id = va.version_id
        WHERE sv.skill_id = ?
        ORDER BY sv.version_number DESC
      `, [skillId]);

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
    enabled: !!skillId,
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

export function useSkillFiles(skillId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filesQuery = useQuery({
    queryKey: ['skill-files', skillId],
    queryFn: async () => {
      if (!skillId) return [];

      const db = await getDatabase();
      const result = db.exec(
        'SELECT id, skill_id, filename, file_type, content, created_at, updated_at FROM skill_files WHERE skill_id = ? ORDER BY file_type, filename',
        [skillId]
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
    enabled: !!skillId,
  });

  const upsertFileMutation = useMutation({
    mutationFn: async ({
      skillId,
      filename,
      file_type,
      content,
      existingId,
    }: {
      skillId: string;
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
          'INSERT INTO skill_files (id, skill_id, filename, file_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, skillId, filename, file_type, content, now, now]
        );
      }

      await saveDatabase();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-files', skillId] });
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
      queryClient.invalidateQueries({ queryKey: ['skill-files', skillId] });
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

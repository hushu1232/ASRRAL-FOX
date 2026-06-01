import { isPostgres } from '@/lib/db';
import { pgQuery } from '@/lib/db/pg';
import { getPrisma } from '@/lib/db';

export const searchService = {
  async search(q: string, workspaceId: string) {
    const query = q.trim();
    if (query.length < 1) {
      return { avatars: [], assets: [], templates: [], searchEngine: 'none' };
    }

    if (isPostgres()) {
      const tsquery = query.split(/\s+/).map(w => w + ':*').join(' & ');

      const [avatarRows, assetRows, templateRows] = await Promise.all([
        pgQuery(
          `SELECT id, name, style, thumbnail_url, status,
                  ts_rank(search_vector, to_tsquery('simple', $1)) AS rank
           FROM avatars
           WHERE search_vector @@ to_tsquery('simple', $1)
             AND (workspace_id = $2 OR is_template = true)
           ORDER BY rank DESC LIMIT 5`,
          [tsquery, workspaceId]
        ),
        pgQuery(
          `SELECT id, filename, asset_type, format, file_size,
                  ts_rank(search_vector, to_tsquery('simple', $1)) AS rank
           FROM assets
           WHERE search_vector @@ to_tsquery('simple', $1)
             AND workspace_id = $2
           ORDER BY rank DESC LIMIT 5`,
          [tsquery, workspaceId]
        ),
        pgQuery(
          `SELECT id, name, style, thumbnail_url
           FROM avatars
           WHERE is_template = true
             AND search_vector @@ to_tsquery('simple', $1)
           ORDER BY ts_rank(search_vector, to_tsquery('simple', $1)) DESC LIMIT 5`,
          [tsquery]
        ),
      ]);

      return {
        avatars: avatarRows,
        assets: assetRows.map(r => ({ ...r, file_size: Number(r.file_size) })),
        templates: templateRows,
        searchEngine: 'postgresql-fts',
      };
    }

    // SQLite fallback: LIKE
    const prisma = getPrisma();
    const likePattern = `%${query}%`;

    const [avatars, assets, templates] = await Promise.all([
      prisma.avatar.findMany({
        where: { workspaceId, name: { contains: query } },
        select: { id: true, name: true, style: true, thumbnailUrl: true, status: true },
        take: 5,
      }),
      prisma.asset.findMany({
        where: { workspaceId, filename: { contains: query } },
        select: { id: true, filename: true, assetType: true, format: true, fileSize: true },
        take: 5,
      }),
      prisma.avatar.findMany({
        where: { isTemplate: true, name: { contains: query } },
        select: { id: true, name: true, style: true, thumbnailUrl: true },
        take: 5,
      }),
    ]);

    return {
      avatars: avatars.map(a => ({ ...a, thumbnail_url: a.thumbnailUrl })),
      assets: assets.map(a => ({
        ...a,
        asset_type: a.assetType,
        file_size: Number(a.fileSize),
      })),
      templates: templates.map(t => ({ ...t, thumbnail_url: t.thumbnailUrl })),
      searchEngine: 'sqlite-like',
    };
  },
};

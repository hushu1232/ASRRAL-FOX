interface ReplyRow {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  content: string;
  voteScore: number;
  isAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; username: string; role: string };
}

interface ReplyNode {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  content: string;
  voteScore: number;
  isAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; username: string; role: string };
  children: ReplyNode[];
}

export function buildReplyTree(replies: ReplyRow[]): ReplyNode[] {
  const map = new Map<string, ReplyNode>();
  const roots: ReplyNode[] = [];

  for (const r of replies) {
    map.set(r.id, { ...r, children: [] });
  }

  for (const r of replies) {
    const node = map.get(r.id)!;
    if (r.parentId && map.has(r.parentId)) {
      map.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function flattenReplies(tree: ReplyNode[], depth = 0): (ReplyNode & { depth: number })[] {
  const result: (ReplyNode & { depth: number })[] = [];
  for (const node of tree) {
    result.push({ ...node, depth });
    result.push(...flattenReplies(node.children, depth + 1));
  }
  return result;
}

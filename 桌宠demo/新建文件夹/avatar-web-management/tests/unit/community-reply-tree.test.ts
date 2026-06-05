import { buildReplyTree, flattenReplies } from '@/app/api/community/posts/[id]/tree';

function makeReply(id: string, parentId: string | null, overrides: Record<string, unknown> = {}) {
  return {
    id,
    postId: 'post-1',
    userId: `user-${id}`,
    parentId,
    content: `Reply ${id}`,
    voteScore: 0,
    isAccepted: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    user: { id: `user-${id}`, username: `User${id}`, role: 'user' },
    ...overrides,
  };
}

describe('community reply tree', () => {
  describe('buildReplyTree', () => {
    it('returns empty array for no replies', () => {
      expect(buildReplyTree([])).toEqual([]);
    });

    it('returns flat roots when no parentId references', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', null),
        makeReply('3', null),
      ];
      const tree = buildReplyTree(replies);
      expect(tree).toHaveLength(3);
      expect(tree[0].children).toEqual([]);
      expect(tree[1].children).toEqual([]);
      expect(tree[2].children).toEqual([]);
    });

    it('builds a 2-level nested tree', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', '1'),
        makeReply('3', '1'),
      ];
      const tree = buildReplyTree(replies);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('1');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].id).toBe('2');
      expect(tree[0].children[1].id).toBe('3');
    });

    it('builds a 3-level deep nested tree', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', '1'),
        makeReply('3', '2'),
      ];
      const tree = buildReplyTree(replies);
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].id).toBe('3');
    });

    it('handles orphan replies (parent not found) as roots', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', 'missing-parent'),
      ];
      const tree = buildReplyTree(replies);
      expect(tree).toHaveLength(2);
      expect(tree.find((n) => n.id === '2')).toBeTruthy();
    });

    it('handles multiple root threads with nested children', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', '1'),
        makeReply('3', null),
        makeReply('4', '3'),
        makeReply('5', '1'),
      ];
      const tree = buildReplyTree(replies);
      expect(tree).toHaveLength(2);
      const root1 = tree.find((n) => n.id === '1')!;
      const root2 = tree.find((n) => n.id === '3')!;
      expect(root1.children).toHaveLength(2);
      expect(root2.children).toHaveLength(1);
    });

    it('preserves reply fields in tree nodes', () => {
      const replies = [
        makeReply('1', null, { content: 'Hello', voteScore: 5, isAccepted: true }),
      ];
      const tree = buildReplyTree(replies);
      expect(tree[0].content).toBe('Hello');
      expect(tree[0].voteScore).toBe(5);
      expect(tree[0].isAccepted).toBe(true);
    });
  });

  describe('flattenReplies', () => {
    it('flattens tree with depth', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', '1'),
        makeReply('3', '2'),
      ];
      const tree = buildReplyTree(replies);
      const flat = flattenReplies(tree);
      expect(flat).toHaveLength(3);
      expect(flat[0].depth).toBe(0);
      expect(flat[1].depth).toBe(1);
      expect(flat[2].depth).toBe(2);
    });

    it('flattens multiple root threads in order', () => {
      const replies = [
        makeReply('1', null),
        makeReply('2', null),
        makeReply('3', '2'),
      ];
      const tree = buildReplyTree(replies);
      const flat = flattenReplies(tree);
      expect(flat.map((n) => n.id)).toEqual(['1', '2', '3']);
      expect(flat.map((n) => n.depth)).toEqual([0, 0, 1]);
    });
  });
});

/**
 * Community vote logic unit tests.
 *
 * Tests the vote toggle logic (赞/踩/取消/切换) without requiring
 * a running database — uses a simple in-memory simulation of the
 * vote state machine defined in the vote route.
 */

interface VoteState {
  userId: string;
  targetType: string;
  targetId: string;
  value: number; // 1 or -1
}

interface VoteResult {
  action: 'created' | 'deleted' | 'updated';
  previousValue?: number;
  newValue?: number;
  scoreDelta: number;
}

/**
 * Simulates the vote toggle logic from POST /api/community/votes
 * without hitting the database.
 */
function simulateVote(
  existingVotes: VoteState[],
  userId: string,
  targetType: string,
  targetId: string,
  value: number,
): { votes: VoteState[]; result: VoteResult } {
  const votes = existingVotes.map((v) => ({ ...v }));
  const key = `${userId}:${targetType}:${targetId}`;
  const existingIdx = votes.findIndex(
    (v) => v.userId === userId && v.targetType === targetType && v.targetId === targetId,
  );

  if (existingIdx >= 0) {
    const existing = votes[existingIdx];
    if (existing.value === value) {
      // Same value → cancel (delete vote)
      votes.splice(existingIdx, 1);
      const delta = value === 1 ? -1 : 1;
      return { votes, result: { action: 'deleted', previousValue: existing.value, scoreDelta: delta } };
    } else {
      // Different value → switch
      votes[existingIdx] = { ...existing, value };
      const delta = value === 1 ? 2 : -2;
      return { votes, result: { action: 'updated', previousValue: existing.value, newValue: value, scoreDelta: delta } };
    }
  }

  // No existing vote → create
  votes.push({ userId, targetType, targetId, value });
  return { votes, result: { action: 'created', newValue: value, scoreDelta: value } };
}

describe('community vote logic', () => {
  const userId = 'user-1';
  const target = { targetType: 'post', targetId: 'post-1' };

  describe('first vote', () => {
    it('creates an upvote with +1 score delta', () => {
      const { votes, result } = simulateVote([], userId, target.targetType, target.targetId, 1);
      expect(result.action).toBe('created');
      expect(result.scoreDelta).toBe(1);
      expect(votes).toHaveLength(1);
      expect(votes[0].value).toBe(1);
    });

    it('creates a downvote with -1 score delta', () => {
      const { votes, result } = simulateVote([], userId, target.targetType, target.targetId, -1);
      expect(result.action).toBe('created');
      expect(result.scoreDelta).toBe(-1);
      expect(votes[0].value).toBe(-1);
    });
  });

  describe('cancel vote (same value again)', () => {
    it('cancels upvote — removes vote, delta -1', () => {
      const existing = [{ userId, targetType: target.targetType, targetId: target.targetId, value: 1 }];
      const { votes, result } = simulateVote(existing, userId, target.targetType, target.targetId, 1);
      expect(result.action).toBe('deleted');
      expect(result.scoreDelta).toBe(-1);
      expect(votes).toHaveLength(0);
    });

    it('cancels downvote — removes vote, delta +1', () => {
      const existing = [{ userId, targetType: target.targetType, targetId: target.targetId, value: -1 }];
      const { votes, result } = simulateVote(existing, userId, target.targetType, target.targetId, -1);
      expect(result.action).toBe('deleted');
      expect(result.scoreDelta).toBe(1);
      expect(votes).toHaveLength(0);
    });
  });

  describe('switch vote (change from up to down or vice versa)', () => {
    it('switches from upvote to downvote — delta -2', () => {
      const existing = [{ userId, targetType: target.targetType, targetId: target.targetId, value: 1 }];
      const { votes, result } = simulateVote(existing, userId, target.targetType, target.targetId, -1);
      expect(result.action).toBe('updated');
      expect(result.previousValue).toBe(1);
      expect(result.newValue).toBe(-1);
      expect(result.scoreDelta).toBe(-2);
      expect(votes[0].value).toBe(-1);
    });

    it('switches from downvote to upvote — delta +2', () => {
      const existing = [{ userId, targetType: target.targetType, targetId: target.targetId, value: -1 }];
      const { votes, result } = simulateVote(existing, userId, target.targetType, target.targetId, 1);
      expect(result.action).toBe('updated');
      expect(result.scoreDelta).toBe(2);
      expect(votes[0].value).toBe(1);
    });
  });

  describe('isolation', () => {
    it('different users can vote on the same target', () => {
      const user2 = 'user-2';
      let votes: VoteState[] = [];
      let result: VoteResult;

      ({ votes, result } = simulateVote(votes, userId, target.targetType, target.targetId, 1));
      expect(result.action).toBe('created');
      expect(votes).toHaveLength(1);

      ({ votes, result } = simulateVote(votes, user2, target.targetType, target.targetId, -1));
      expect(result.action).toBe('created');
      expect(votes).toHaveLength(2);
      expect(votes[0].value).toBe(1);
      expect(votes[1].value).toBe(-1);
    });

    it('votes on different targets do not conflict', () => {
      let votes: VoteState[] = [];
      let result: VoteResult;

      ({ votes, result } = simulateVote(votes, userId, 'post', 'post-1', 1));
      ({ votes, result } = simulateVote(votes, userId, 'post', 'post-2', -1));
      ({ votes, result } = simulateVote(votes, userId, 'reply', 'reply-1', 1));

      expect(votes).toHaveLength(3);
    });
  });
});

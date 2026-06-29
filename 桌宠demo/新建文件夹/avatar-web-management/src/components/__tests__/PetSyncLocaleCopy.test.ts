const en = require('../../../messages/en.json');
const zh = require('../../../messages/zh-CN.json');
const ja = require('../../../messages/ja.json');

describe('pet sync locale copy', () => {
  it('uses Alife .NET wording in English sync copy', () => {
    expect(en.pet.consoleSubtitle).toBe(
      'Prepare and validate the Web pet configuration here. Alife .NET applies staged changes only after local confirmation.',
    );
    expect(en.pet.syncStatus.action.confirmInDesktop).toBe('Confirm in Alife .NET');
    expect(en.pet.syncStatus.action.openDesktop).toBe('Open Alife .NET');
    expect(en.pet.syncStatus.actionHint.confirmInDesktop).toBe(
      'Confirm the staged package inside Alife .NET. Web activation is not available.',
    );
    expect(en.pet.runtimeSummary.nextAction.checkAgain).toBe(
      'Check Alife .NET runtime status again',
    );
    expect(en.pet.runtimeSummary.nextAction.openDesktop).toBe('Open Alife .NET runtime');
    expect(en.pet.runtimeSummary.nextAction.confirmInDesktop).toBe(
      'Confirm the staged package inside Alife .NET',
    );
    expect(en.pet.syncStatus.previewChip.localConfirmationRequired).toBe('Confirm locally');
    expect(en.pet.syncStatus.previewChip.upToDate).toBe('Synced');
    expect(en.pet.syncStatus.lifecycle.staged.title).toBe('Alife .NET staged');
    expect(en.pet.syncStatus.lifecycle.staged.description).toBe(
      'Alife .NET has pulled and validated the package.',
    );
    expect(en.pet.syncStatus.lifecycle.applied.description).toBe(
      'Alife .NET is running the current version.',
    );
  });

  it('uses Alife .NET wording in Simplified Chinese sync copy', () => {
    expect(zh.pet.consoleSubtitle).toBe(
      '在此准备并验证 Web 桌宠配置。Alife .NET 只会在本地确认后应用暂存变更。',
    );
    expect(zh.pet.syncStatus.action.confirmInDesktop).toBe('在 Alife .NET 中确认');
    expect(zh.pet.syncStatus.action.openDesktop).toBe('打开 Alife .NET');
    expect(zh.pet.syncStatus.actionHint.confirmInDesktop).toBe(
      '请在 Alife .NET 中确认已暂存的包。Web 不提供本地激活操作。',
    );
    expect(zh.pet.runtimeSummary.nextAction.checkAgain).toBe('重新检查 Alife .NET 运行状态');
    expect(zh.pet.runtimeSummary.nextAction.openDesktop).toBe('打开 Alife .NET 运行时');
    expect(zh.pet.runtimeSummary.nextAction.confirmInDesktop).toBe(
      '在 Alife .NET 中确认已暂存的包',
    );
    expect(zh.pet.syncStatus.previewChip.localConfirmationRequired).toBe('待本地确认');
    expect(zh.pet.syncStatus.previewChip.upToDate).toBe('已同步');
    expect(zh.pet.syncStatus.lifecycle.staged.title).toBe('Alife .NET 已暂存');
    expect(zh.pet.syncStatus.lifecycle.staged.description).toBe(
      'Alife .NET 已拉取并验证该包。',
    );
    expect(zh.pet.syncStatus.lifecycle.applied.description).toBe(
      'Alife .NET 正在运行当前版本。',
    );
  });

  it('uses Alife .NET wording in Japanese sync copy', () => {
    expect(ja.pet.consoleSubtitle).toBe(
      'ここで Web ペット設定を準備し、検証します。Alife .NET はローカル確認後にのみステージ済みの変更を適用します。',
    );
    expect(ja.pet.syncStatus.action.confirmInDesktop).toBe('Alife .NET で確認');
    expect(ja.pet.syncStatus.action.openDesktop).toBe('Alife .NET を開く');
    expect(ja.pet.syncStatus.actionHint.confirmInDesktop).toBe(
      'ステージ済みパッケージは Alife .NET で確認してください。Web からのローカル適用はできません。',
    );
    expect(ja.pet.runtimeSummary.nextAction.checkAgain).toBe(
      'Alife .NET ランタイム状態を再確認',
    );
    expect(ja.pet.runtimeSummary.nextAction.openDesktop).toBe('Alife .NET ランタイムを開く');
    expect(ja.pet.runtimeSummary.nextAction.confirmInDesktop).toBe(
      'ステージ済みパッケージを Alife .NET で確認',
    );
    expect(ja.pet.syncStatus.previewChip.localConfirmationRequired).toBe('確認待ち');
    expect(ja.pet.syncStatus.previewChip.upToDate).toBe('同期済み');
    expect(ja.pet.syncStatus.lifecycle.staged.title).toBe('Alife .NET ステージ済み');
    expect(ja.pet.syncStatus.lifecycle.staged.description).toBe(
      'Alife .NET はパッケージを取得し検証しました。',
    );
    expect(ja.pet.syncStatus.lifecycle.applied.description).toBe(
      'Alife .NET は現在のバージョンを実行しています。',
    );
  });
});

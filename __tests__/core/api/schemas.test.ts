import {
  LoginResponseSchema,
  SettingsSchema,
  VideoSchema,
  PasswordEnabledSchema,
  parseWithSchema,
} from '../../../src/core/api/schemas';

describe('zod schemas at API boundary', () => {
  test('LoginResponseSchema accepts success and failure shapes', () => {
    expect(
      LoginResponseSchema.safeParse({ success: true, role: 'admin' }).success
    ).toBe(true);
    expect(
      LoginResponseSchema.safeParse({
        success: false,
        waitTime: 30,
        message: 'no',
      }).success
    ).toBe(true);
  });

  test('LoginResponseSchema rejects a missing role on success', () => {
    expect(LoginResponseSchema.safeParse({ success: true }).success).toBe(false);
  });

  test('SettingsSchema accepts unknown additive fields', () => {
    const result = SettingsSchema.safeParse({
      theme: 'dark',
      websiteName: 'MyTube',
      brandNewServerField: 'value',
    });
    expect(result.success).toBe(true);
  });

  test('VideoSchema requires id and title', () => {
    expect(VideoSchema.safeParse({ id: 'v1', title: 'A' }).success).toBe(true);
    expect(VideoSchema.safeParse({ title: 'A' }).success).toBe(false);
  });

  test('PasswordEnabledSchema requires enabled boolean', () => {
    expect(PasswordEnabledSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(PasswordEnabledSchema.safeParse({}).success).toBe(false);
  });

  test('parseWithSchema returns parsed data on success', () => {
    const parsed = parseWithSchema(
      VideoSchema,
      { id: 'v1', title: 'T' },
      'test'
    );
    expect(parsed.id).toBe('v1');
  });

  test('parseWithSchema returns raw data on failure (loose by design)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const parsed = parseWithSchema(
      VideoSchema,
      { totally: 'wrong shape' } as unknown,
      'test'
    );
    expect(parsed).toEqual({ totally: 'wrong shape' });
    warn.mockRestore();
  });

  test('parseWithSchema throws on failure in strict mode', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      parseWithSchema(
        LoginResponseSchema,
        { success: true } as unknown,
        'verifyAdminPassword',
        { mode: 'throw' }
      )
    ).toThrow();
    warn.mockRestore();
  });
});

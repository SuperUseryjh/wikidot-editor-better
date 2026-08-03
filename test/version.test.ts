import { describe, expect, test } from 'bun:test';
import { compareVersions } from '../src/version';

describe('compareVersions', () => {
    test('比较核心版本号', () => {
        expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0);
        expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    test('按 alpha、beta、正式版顺序比较', () => {
        expect(compareVersions('1.0.0-alpha2', '1.0.0-alpha1')).toBeGreaterThan(0);
        expect(compareVersions('1.0.0-beta1', '1.0.0-alpha99')).toBeGreaterThan(0);
        expect(compareVersions('1.0.0', '1.0.0-beta99')).toBeGreaterThan(0);
    });

    test('比较同一测试通道的序号', () => {
        expect(compareVersions('1.0.0-alpha10', '1.0.0-alpha2')).toBeGreaterThan(0);
        expect(compareVersions('1.0.0-beta2', '1.0.0-beta10')).toBeLessThan(0);
    });

    test('拒绝不符合项目约定的版本格式', () => {
        expect(compareVersions('1.0', '1.0.0')).toBeNull();
        expect(compareVersions('v1.0.0', '1.0.0')).toBeNull();
        expect(compareVersions('1.0.0-rc1', '1.0.0')).toBeNull();
        expect(compareVersions('', '1.0.0')).toBeNull();
    });
});

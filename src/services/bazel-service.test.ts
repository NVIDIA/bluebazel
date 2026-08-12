import { BazelService } from './bazel-service';
import { ConfigurationManager } from './configuration-manager';
import { ShellService } from './shell-service';

describe('BazelService.fetchAllTargetsFromQuery', () => {
    it('creates package targets with valid bazel paths', async () => {
        const mockContext = {} as any;
        const mockConfig = {
            getExecutableCommand: jest.fn().mockReturnValue('bazel'),
            shouldFetchTargetsUsingQuery: jest.fn().mockReturnValue(true),
        } as unknown as ConfigurationManager;
        const mockShell = {
            runShellCommand: jest.fn().mockResolvedValue({
                stdout: [
                    '### Run Targets',
                    'cc_binary rule //pkg/app:bin',
                    '### Test Targets',
                    'cc_test rule //pkg/lib:test',
                    '### Other Targets',
                    'cc_library rule //pkg/lib:lib',
                ].join('\\n'),
            }),
        } as unknown as ShellService;

        const service = new BazelService(mockContext, mockConfig, mockShell);
        const targets = await service.fetchAllTargetsFromQuery();

        const packageTargets = targets.filter(
            t => t.ruleType === 'package_test' || t.ruleType === 'package_build'
        );
        expect(packageTargets).toHaveLength(2);

        for (const target of packageTargets) {
            expect(target.bazelPath).toBe('//pkg/lib/...');
            expect(target.bazelPath).not.toContain(',');
            expect(target.bazelPath.startsWith('////')).toBe(false);
        }

        const testPackage = packageTargets.find(t => t.ruleType === 'package_test');
        expect(testPackage).toBeDefined();

        const buildPackage = packageTargets.find(t => t.ruleType === 'package_build');

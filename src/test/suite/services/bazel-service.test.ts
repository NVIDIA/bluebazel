////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2025 NVIDIA Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
////////////////////////////////////////////////////////////////////////////////////
import { BazelTarget } from '../../../models/bazel-target';
import { BazelService } from '../../../services/bazel-service';
import { ConfigurationManager } from '../../../services/configuration-manager';
import { Console } from '../../../services/console';
import { ShellService } from '../../../services/shell-service';
import { WorkspaceService } from '../../../services/workspace-service';
import * as assert from 'assert';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as vscode from 'vscode';


suite('BazelService Tests', () => {
    let bazelService: BazelService;
    let mockContext: vscode.ExtensionContext;
    let mockConfigurationManager: sinon.SinonStubbedInstance<ConfigurationManager>;
    let mockShellService: sinon.SinonStubbedInstance<ShellService>;
    let mockWorkspaceService: sinon.SinonStubbedInstance<WorkspaceService>;

    setup(() => {
        // Mock dependencies
        mockContext = {
            workspaceState: {
                get: (key: string) => undefined,
                update: async (key: string, value: unknown) => Promise.resolve(),
            },
            extension: {
                id: 'test.bluebazel',
                extensionUri: vscode.Uri.file('/test'),
                packageJSON: {
                    displayName: 'Blue Bazel Test'
                }
            }
        } as unknown as vscode.ExtensionContext;

        // Initialize Console singleton
        Console.initialize(mockContext);

        mockConfigurationManager = sinon.createStubInstance(ConfigurationManager);
        mockShellService = sinon.createStubInstance(ShellService);
        mockWorkspaceService = sinon.createStubInstance(WorkspaceService);

        // Initialize BazelService
        bazelService = new BazelService(mockContext, mockConfigurationManager, mockShellService);
        console.log(bazelService);
    });

    teardown(() => {
        sinon.restore();
    });

    test('fetchTargetActions should return actions requiring a target', async () => {
        const actions = await bazelService.fetchTargetActions();
        assert.deepStrictEqual(actions, [
            'aquery',
            'build',
            'coverage',
            'cquery',
            'mobile-install',
            'print_action',
            'query',
            'run',
            'test'
        ]);
    });

    test('formatBazelTargetFromPath should correctly format a target path', () => {
        const targetPath = 'bazel-bin/src/test_target';
        const result = BazelService.formatBazelTargetFromPath(targetPath);
        assert.strictEqual(result, '//src:test_target');
    });

    test('fetchAllTargets should call the appropriate fetch method', async () => {
        // Mock methods
        mockConfigurationManager.shouldFetchTargetsUsingQuery.returns(false);
        sinon.stub(bazelService, 'fetchAllTargetsFromBuildFiles').resolves([]);
        sinon.stub(bazelService, 'fetchAllTargetsFromQuery').resolves([]);

        // Call fetchAllTargets
        await bazelService.fetchAllTargets();

        // Ensure the correct method was called
        sinon.assert.calledOnce(bazelService.fetchAllTargetsFromBuildFiles as sinon.SinonStub);
        sinon.assert.notCalled(bazelService.fetchAllTargetsFromQuery as sinon.SinonStub);
    });

    test('fetchAllTargetsByAction should categorize targets correctly', async () => {
        // Mock fetchAllTargets
        sinon.stub(bazelService, 'fetchAllTargets').resolves([
            {
                label: 'test_target',
                ruleType: 'cc_test',
                bazelPath: '//src:test_target',
                buildPath: '/bazel-bin/src/test_target',
            } as BazelTarget,
        ]);

        const result = await bazelService.fetchAllTargetsByAction();

        // Verify categorization
        assert.strictEqual(result.get('test')?.length, 1);
        assert.strictEqual(result.get('build')?.length, 1);
        assert.strictEqual(result.get('run')?.length, 1);
    });

    test('fetchAllTargetsFromQuery should parse query results', async () => {
        // Mock ShellService results
        mockShellService.runShellCommand.resolves({
            stdout: 'cc_test package //src:test_target\ncc_binary package //src:test_binary',
            stderr: '',
        });

        const result = await bazelService.fetchAllTargetsFromQuery();
        assert.strictEqual(result.length, 5);

        // Verify target parsing
        assert.strictEqual(result[0].label, 'test_target');
        assert.strictEqual(result[0].ruleType, 'cc_test');
        assert.strictEqual(result[0].bazelPath, '//src:test_target');
        assert.strictEqual(result[0].buildPath, '/bazel-bin/src/test_target');
    });

    test('findWorkspaceRoot should find the correct workspace directory', () => {
        // Mock filesystem structure
        const mockFs = sinon.stub(fs, 'existsSync');
        mockFs.withArgs(sinon.match(/WORKSPACE/)).returns(true);

        const result = BazelService['findWorkspaceRoot']('/mock/path/to/project');
        assert.strictEqual(result, '/mock/path/to/project');

        mockFs.restore();
    });
});

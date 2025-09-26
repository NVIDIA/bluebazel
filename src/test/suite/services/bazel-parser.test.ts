////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2024 NVIDIA Corporation
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
import { BAZEL_BIN, BazelParser } from '../../../services/bazel-parser';
import { Console } from '../../../services/console';
import * as assert from 'assert';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

async function createTempDir(): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'bazel-test-');
    return await fsPromises.mkdtemp(tempDir);
}

async function createBazelFiles(
    tempDir: string,
    workspacePaths: string[] = [],
    buildFilePaths: { [dir: string]: string } = {}
): Promise<{ workspace: string[]; build: string[] }> {
    const workspaceFiles: string[] = [];
    const buildFiles: string[] = [];

    for (const workspace of workspacePaths) {
        const workspacePath = path.join(tempDir, workspace);
        await fsPromises.mkdir(path.dirname(workspacePath), { recursive: true });
        await fsPromises.writeFile(workspacePath, '# WORKSPACE file');
        workspaceFiles.push(workspacePath);
    }

    for (const [dir, content] of Object.entries(buildFilePaths)) {
        const buildFilePath = path.join(tempDir, dir, 'BUILD');
        await fsPromises.mkdir(path.dirname(buildFilePath), { recursive: true });
        await fsPromises.writeFile(buildFilePath, content);
        buildFiles.push(buildFilePath);
    }

    return { workspace: workspaceFiles, build: buildFiles };
}

suite('BazelParser', () => {
    let tempDir: string;

    setup(async () => {
        // Initialize Console singleton for tests
        const mockContext = {
            extension: {
                id: 'test.bluebazel',
                extensionUri: vscode.Uri.file('/test'),
                packageJSON: {
                    displayName: 'Blue Bazel Test'
                }
            }
        } as unknown as vscode.ExtensionContext;
        Console.initialize(mockContext);
        
        tempDir = await createTempDir();
    });

    teardown(async () => {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
    });

    test('should find all workspace and build files', async () => {
        const { workspace, build } = await createBazelFiles(tempDir, ['WORKSPACE'], {
            'src': `
py_binary(
    name = "test_target",
    srcs = ["test.py"],
)
            `,
        });

        const result = await BazelParser.findBazelBuildFiles(tempDir);

        assert.deepStrictEqual(result.workspace.sort(), workspace.sort());
        assert.deepStrictEqual(result.build.sort(), build.sort());
    });

    test('should parse build files with correct bazel paths', async () => {
        const workspaceFile = 'WORKSPACE';
        const buildContent = `
cc_library(
    name = "test_lib",
    srcs = ["lib.cpp"],
)

py_binary(
    name = "test_bin",
    srcs = ["main.py"],
)
        `;
        const { build } = await createBazelFiles(tempDir, [workspaceFile], { 'src': buildContent });

        const result = await BazelParser.parseBazelBuildFileTargets(build[0], tempDir);

        assert.strictEqual(result.targets.length, 2);

        assert.deepStrictEqual(result.targets[0], {
            name: 'test_lib',
            ruleType: 'cc_library',
            srcExtensions: ['.cpp'],
            bazelPath: '//src:test_lib',
            buildPath: path.join(BAZEL_BIN, 'src', 'test_lib'),
        });

        assert.deepStrictEqual(result.targets[1], {
            name: 'test_bin',
            ruleType: 'py_binary',
            srcExtensions: ['.py'],
            bazelPath: '//src:test_bin',
            buildPath: path.join(BAZEL_BIN, 'src', 'test_bin'),
        });
    });

    test('should handle multiple workspace files correctly', async () => {
        const { workspace, build } = await createBazelFiles(tempDir, ['root/WORKSPACE', 'subdir/WORKSPACE'], {
            'subdir/src': `
py_binary(
    name = "sub_target",
    srcs = ["sub_main.py"],
)
            `,
        });

        const resultWithoutPackage = await BazelParser.parseAllBazelBuildFilesTargets(tempDir, path.join(tempDir, 'root'), '.*', false);

        assert.strictEqual(resultWithoutPackage.length, 1);

        const result = await BazelParser.parseAllBazelBuildFilesTargets(tempDir, path.join(tempDir, 'root'), '.*', true);

        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].bazelPath, '//src:sub_target');
        assert.strictEqual(result[0].buildPath, path.join(BAZEL_BIN, 'src', 'sub_target'));
    });

    test('should ignore directories without WORKSPACE or BUILD files', async () => {
        const result = await BazelParser.findBazelBuildFiles(tempDir);

        assert.deepStrictEqual(result, { workspace: [], build: [] });
    });

    test('should support cancellation tokens', async () => {
        const cancellationToken = new vscode.CancellationTokenSource();
        cancellationToken.cancel();

        const task = BazelParser.parseAllBazelBuildFilesTargets(tempDir, tempDir, '.*', true, cancellationToken.token);

        await assert.rejects(task, /cancelled/);
    });

    test('should parse srcs and target names correctly', async () => {
        const buildContent = `
cc_library(
    name = "test_target",
    srcs = ["test.cpp", "utils.cpp"],
)
        `;

        const { build } = await createBazelFiles(tempDir, ['WORKSPACE'], { 'src': buildContent });

        const result = await BazelParser.parseBazelBuildFileTargets(build[0], tempDir);

        assert.strictEqual(result.targets.length, 1);
        assert.strictEqual(result.targets[0].name, 'test_target');
        assert.deepStrictEqual(result.targets[0].srcExtensions, ['.cpp', '.cpp']);
    });
});

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

import { Console } from './console';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export const BAZEL_BIN = 'bazel-bin';
export class BazelParser {
    /**
     * Finds all Bazel workspace and build files under the given root directory.
     * @param rootDir The root directory to search from.
     * @returns An array of file paths to Bazel build files.
     */
    public static async findBazelBuildFiles(rootDir: string): Promise<{workspace: string[], build: string[]}> {
        Console.debug('Find all bazel build and workspace files...');
        const bazelFiles: string[] = [];
        const workspaceFiles: string[] = [];
        const stack: string[] = [rootDir];

        while (stack.length) {
            const currentBatch = stack.splice(0, 50); // Process up to 50 directories at a time
            const promises = currentBatch.map(async (dir) => {
                try {
                    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            stack.push(fullPath); // Skip hidden directories
                        } else if (/^BUILD(\.bazel)?$/.test(entry.name)) {
                            bazelFiles.push(fullPath);
                        } else if (/^WORKSPACE(\.bazel)?$/.test(entry.name)) {
                            workspaceFiles.push(fullPath);
                        } else if (/^MODULE(\.bazel)?$/.test(entry.name)) {
                            workspaceFiles.push(fullPath);
                        }
                    }
                } catch (err) {
                    Console.error(`Error reading directory ${dir}:`, (err as Error).message || err);
                }
            });
            await Promise.all(promises);
        }

        Console.debug(`Found ${workspaceFiles.length} workspace files and ${bazelFiles.length} build files.`);
        return {workspace: workspaceFiles, build: bazelFiles};
    }

    public static async parseBazelBuildFileTargets(
        filePath: string,
        workspaceRoot: string,
        ruleTypeRegex = '.*',
    ): Promise<
        {
            hasTest: boolean;
            targets: {
                name: string;
                ruleType: string;
                srcExtensions: string[];
                bazelPath: string;
                buildPath: string;
            }[];
        }
    > {
        const content = await fsPromises.readFile(filePath, 'utf8');

        const lines = content.split('\n'); // Process line by line to reduce memory overhead
        const parsedTargets: {
            name: string;
            ruleType: string;
            srcExtensions: string[];
            bazelPath: string;
            buildPath: string;
        }[] = [];

        const correctedPath = path.dirname(filePath).replace(/\\/g, '/');
        const relativePath = path.relative(workspaceRoot, correctedPath);
        const bazelPath = `//${relativePath}`;
        const buildPath = path.join(BAZEL_BIN, ...relativePath.split('/'));

        let hasTest = false;
        let currentRule: string | null = null;
        let currentName: string | null = null;
        let currentSrcs: string[] = [];

        for (const line of lines) {
            const ruleMatch = new RegExp(`^(${ruleTypeRegex})\\(`).exec(line.trim());
            const nameMatch = /name\s*=\s*"([^"]+)"/.exec(line.trim());
            const srcsMatch = /srcs\s*=\s*\[([^\]]+)\]/.exec(line.trim());

            if (ruleMatch) {
                if (currentRule && currentName) {
                    // Push the last parsed target
                    parsedTargets.push({
                        name: currentName,
                        ruleType: currentRule,
                        srcExtensions: currentSrcs.map((src) => path.extname(src)),
                        bazelPath: `${bazelPath}:${currentName}`,
                        buildPath: path.join(buildPath, currentName),
                    });
                }

                // Start a new rule
                currentRule = ruleMatch[1];
                currentName = null;
                currentSrcs = [];
                hasTest = hasTest || currentRule.includes('test');
            }

            if (nameMatch) {
                currentName = nameMatch[1];
            }

            if (srcsMatch) {
                currentSrcs = srcsMatch[1]
                    .split(',')
                    .map((src) => src.trim().replace(/"/g, ''))
                    .filter((src) => src);
            }
        }

        // Add the last target if applicable
        if (currentRule && currentName) {
            parsedTargets.push({
                name: currentName,
                ruleType: currentRule,
                srcExtensions: currentSrcs.map((src) => path.extname(src)),
                bazelPath: `${bazelPath}:${currentName}`,
                buildPath: path.join(buildPath, currentName),
            });
        }

        return { hasTest, targets: parsedTargets };
    }

    private static findClosestWorkspace(buildFilePath: string, workspaceSet: Set<string>): string | null {
        let currentDir = path.dirname(buildFilePath);

        while (currentDir !== path.parse(currentDir).root) {
            const workspacePath = currentDir;
            if (workspaceSet.has(workspacePath)) {
                // Found the closest WORKSPACE
                return workspacePath;
            }
            // Move up one directory level
            currentDir = path.dirname(currentDir);
        }

        return null; // No WORKSPACE found
    }

    /**
     * Recursively finds and parses all Bazel build files under the given root directory.
     * @param rootDir The root directory to search from.
     * @returns An array of parsed Bazel targets across all files.
     */
    public static async parseAllBazelBuildFilesTargets(rootDir: string, workspaceFolder: string, ruleTypeRegex = '.*', includeOutputPackages = true, cancellationToken?: vscode.CancellationToken): Promise<
        { name: string; ruleType: string; srcExtensions: string[]; bazelPath: string, buildPath: string }[]
    > {
        Console.debug('Parsing all bazel build file targets...');
        const bazelFiles = await this.findBazelBuildFiles(rootDir);

        const workspaceFiles = new Set(bazelFiles.workspace.map(workspaceFile => path.dirname(workspaceFile)));
        const results = await Promise.all(
            bazelFiles.build.map(async (filePath) => {
                try {
                    if (cancellationToken && cancellationToken?.isCancellationRequested) {
                        throw new Error('Parse all bazel build files cancelled');
                    }

                    const workspaceRoot = this.findClosestWorkspace(filePath, workspaceFiles) || workspaceFolder;

                    const buildFileResult = await this.parseBazelBuildFileTargets(filePath, workspaceRoot, ruleTypeRegex);
                    return { filePath, targets: buildFileResult.targets, hasTest: buildFileResult.hasTest };
                } catch (err) {
                    Console.error(`Error parsing file ${filePath}:`, (err as Error).message || err);
                    return null;
                }
            })
        );

        if (cancellationToken && cancellationToken?.isCancellationRequested) {
            return Promise.reject('Parse all bazel build files cancelled');
        }

        // Filter out null values
        const buildFileTargets = results.filter((result): result is { filePath: string; targets: { name: string; ruleType: string; srcExtensions: string[]; bazelPath: string, buildPath: string }[]; hasTest: boolean } => result !== null);


        const targets: { name: string; ruleType: string; srcExtensions: string[]; bazelPath: string, buildPath: string }[] =  [];

        buildFileTargets.forEach(buildFileSet => {
            if (cancellationToken && cancellationToken?.isCancellationRequested) {
                return Promise.reject('Parse all bazel build files cancelled');
            }
            if (buildFileSet.targets.length === 0) {
                return;
            }
            if (includeOutputPackages) {
                const pathPart = buildFileSet.targets[0].bazelPath.split(':')[0];
                const bazelPath = `/${path.join(pathPart, '...')}`;
                const buildPath = path.join(BAZEL_BIN, pathPart);
                buildFileSet.targets.push({
                    name: bazelPath,
                    ruleType: buildFileSet.hasTest ? 'package_test' : 'package_build',
                    srcExtensions: [],
                    bazelPath: bazelPath,
                    buildPath: buildPath
                });
            }
            targets.push(...buildFileSet.targets);
        });

        Console.debug(`Found ${targets.length} targets...`);

        return targets;
    }

}
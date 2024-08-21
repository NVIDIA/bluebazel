/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2023 NVIDIA Corporation
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
/////////////////////////////////////////////////////////////////////////////////////////

export const BUILD_RUN_TARGET_STR = '<Run Target>';
export const BAZEL_BIN = 'bazel-bin';

export enum TargetType {
    BUILD = 'build',
    RUN = 'run',
    TEST = 'test'
}

export const WORKSPACE_KEYS = {
    buildTarget: 'buildTarget',
    runTarget: 'runTarget',
    testTarget: 'testTarget',
    buildEnvVars: 'buildEnvVar',
    runEnvVars: 'runEnvVars',
    testEnvVars: 'testEnvVars',
    buildConfigs: 'buildConfigs',
    runConfigs: 'runConfigs',
    testConfigs: 'testConfigs',
    bazelBuildArgs: 'bazelBuildArgs',
    bazelRunArgs: 'bazelRunArgs',
    bazelTestArgs: 'bazelTestArgs',
    runArgs: 'runArgs',
    testArgs: 'testArgs',
    setupEnvVars: 'setupEnvVars',
    targetSections: 'targetSections'
};

export const CONFIG_KEYWORDS = {
    executable: 'bluebazel.executable',
    runTarget: 'bluebazel.runTarget',
    buildTarget: 'bluebazel.buildTarget',
    testTarget: 'bluebazel.testTarget',
    runArgs: 'bluebazel.runArgs',
    testArgs: 'bluebazel.testArgs',
    buildConfigs: 'bluebazel.buildConfigs',
    runConfigs: 'bluebazel.runConfigs',
    testConfigs: 'bluebazel.testConfigs',
    bazelBuildArgs: 'bluebazel.bazelBuildArgs',
    bazelRunArgs: 'bluebazel.bazelRunArgs',
    bazelTestArgs: 'bluebazel.bazelTestArgs',
    buildEnvVars: 'bluebazel.buildEnvVars',
    runEnvVars: 'bluebazel.runEnvVars',
    testEnvVars: 'bluebazel.testEnvVars',
    formatCommand: 'bluebazel.formatCommand'
};

export const CONFIG_SECTIONS = {
    build: 'Build',
    run: 'Run',
    test: 'Test'
};

export const EXTENSION_COMMANDS = {
    pick: 'Pick',
    input: 'Input'
};

export function getWorkspaceKeyUniqueToTarget(key: string, target: string): string {
    return `${key}For${target}`;
}


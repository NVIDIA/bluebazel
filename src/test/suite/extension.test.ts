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
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension E2E Tests', () => {
    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension('NVIDIA.bluebazel');
        assert.notStrictEqual(extension, undefined);
        await extension?.activate();
    });

    test('Commands are registered', () => {
        // Test if commands are correctly registered
        const extension = vscode.extensions.getExtension('NVIDIA.bluebazel');
        assert.notStrictEqual(extension, undefined);
        if (extension === undefined) {
            return false;
        }
        vscode.commands.getCommands(true).then((registeredCommands: string[]) => {
            const expectedCommands = extension.packageJSON.commands;
            for (const cmd of expectedCommands) {
                assert.ok(registeredCommands.includes(cmd), `Command '${cmd}' is not registered.`);
            }
        });
    });

});
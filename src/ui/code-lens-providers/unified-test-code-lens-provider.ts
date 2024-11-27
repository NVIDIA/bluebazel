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
import { BazelTarget } from '../../models/bazel-target';
import { BazelService } from '../../services/bazel-service';
import { Console } from '../../services/console';
import { ExtensionUtils } from '../../services/extension-utils';
import * as vscode from 'vscode';

export class UnifiedTestCodeLensProvider implements vscode.CodeLensProvider {

    private readonly testRegexes: { language: string; regex: RegExp }[] = [
        { language: 'go', regex: /^func\s+(Test\w+)\(\w+\s+\*testing\.T\)/gm }, // Go test functions
        { language: 'cpp', regex: /\b(?:TEST|TEST_F|TYPED_TEST|TYPED_TEST_P)\s*\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\)/gm }, // C++/C test macros
        { language: 'c', regex: /\b(?:TEST|TEST_F|TYPED_TEST|TYPED_TEST_P)\s*\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\)/gm }, // C test macros
        { language: 'python', regex: /(?:^|\s)def\s+(test_\w+)\(/gm }, // Python pytest/unittest functions
    ];

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService
    ) {}

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const language = document.languageId; // Detect the language of the document

        // Match the correct regex based on the document's language
        const matchPattern = this.testRegexes.find(({ language: lang }) => lang === language);
        if (!matchPattern) {
            return [];
        }
        const extensionName = ExtensionUtils.getExtensionName(this.context);
        const extensionDisplayName = ExtensionUtils.getExtensionDisplayName(this.context);

        const { regex } = matchPattern;
        let match;

        while ((match = regex.exec(text)) !== null) {
            let functionName = '';
            if (language === 'cpp' || language === 'c') {
                // Combine FixtureName and TestName for C++/C tests
                const fixtureName = match[2];
                const testName = match[3];
                functionName = `${fixtureName}.${testName}`;
            } else {
                // Use captured test function name for other languages
                functionName = match[1] || match[2];
            }
            const line = document.lineAt(document.positionAt(match.index).line);
            const targets = BazelService.extractBazelTargetsAssociatedWithSourceFile(document.fileName);

            if (targets.length === 0) {
                continue;
            }

            Console.info(`Installing code lens provider for tests on ${functionName}...`);

            const realTargets = targets.map(target => {
                return new BazelTarget(this.context, this.bazelService, target.label, target.bazelPath, target.buildPath, 'test', target.ruleType);
            });
            const target = realTargets[0];
            target.action = 'test';

            // Modify run arguments for the specific function
            target.getBazelArgs().add(`--test_filter=${functionName}`);
            codeLenses.push(
                new vscode.CodeLens(line.range, {
                    title: `${extensionName} test`,
                    tooltip: extensionDisplayName,
                    command: `${extensionName}.executeTarget`,
                    arguments: [target],
                })
            );

            const debugTarget = target.clone(true);
            debugTarget.getBazelArgs().add('--compilation_mode=dbg');

            codeLenses.push(
                new vscode.CodeLens(line.range, {
                    title: `${extensionName} debug`,
                    tooltip: extensionDisplayName,
                    command: `${extensionName}.debugTarget`,
                    arguments: [debugTarget],
                })
            );
        }

        return codeLenses;
    }
}

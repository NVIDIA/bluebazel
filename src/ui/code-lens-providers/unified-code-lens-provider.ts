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
import { LanguageRegistry } from '../../languages/language-registry';
import { BazelAction, BazelTarget } from '../../models/bazel-target';
import { BazelService } from '../../services/bazel-service';
import { Console } from '../../services/console';
import { ExtensionUtils } from '../../services/extension-utils';
import * as vscode from 'vscode';

enum PatternType {
    Run,
    Test
}
interface Pattern {
    type: PatternType;
    language: string;
    regex: RegExp;
}

export class UnifiedCodeLensProvider implements vscode.CodeLensProvider {

    private readonly regexPatterns: Pattern[];

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService
    ) {
        this.regexPatterns = [];
        const languages = LanguageRegistry.getLanguages();
        const testRegexes = languages.map(language => {
            try {
                return {
                    language: language,
                    type: PatternType.Test,
                    regex: LanguageRegistry.getPlugin(language).getCodeLensTestRegex()
                };
            } catch (error) {
                return undefined;
            }
        }).filter(Boolean) as Pattern[];

        const runRegexes = languages.map(language => {
            try {
                return {
                    language: language,
                    type: PatternType.Run,
                    regex: LanguageRegistry.getPlugin(language).getCodeLensRunRegex()
                };
            } catch (error) {
                return undefined;
            }
        }).filter(Boolean) as Pattern[];

        this.regexPatterns.push(...testRegexes);
        this.regexPatterns.push(...runRegexes);
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        // Match the correct regex based on the document's language
        const codeLenses: vscode.CodeLens[] = [];

        this.regexPatterns
            .filter(pattern => pattern.language === document.languageId)
            .forEach(pattern => {
                const lenses = this.processRegexPattern(document, pattern, token);
                codeLenses.push(...lenses);
            });

        return codeLenses;
    }

    private processRegexPattern(document: vscode.TextDocument, pattern: Pattern, _token: vscode.CancellationToken): vscode.CodeLens[] {
        const text = document.getText();
        const language = document.languageId; // Detect the language of the document
        const codeLenses: vscode.CodeLens[] = [];

        const extensionName = ExtensionUtils.getExtensionName(this.context);
        const extensionDisplayName = ExtensionUtils.getExtensionDisplayName(this.context);

        const { regex } = pattern;
        let match;


        let action: BazelAction = 'run';
        if (pattern.type === PatternType.Run) {
            action = 'run';
        } else if (pattern.type === PatternType.Test) {
            action = 'test';
        }

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

            Console.info(`Installing code lens provider for ${action} on ${functionName}...`);

            const realTargets = targets.map(target => {
                return new BazelTarget(this.context, this.bazelService, target.label, target.bazelPath, target.buildPath, action, target.ruleType);
            });

            const target = realTargets[0];

            // Modify run arguments for the specific function
            if (pattern.type === PatternType.Test) {
                target.getBazelArgs().add(`--test_filter=${functionName}`);
            }
            codeLenses.push(
                new vscode.CodeLens(line.range, {
                    title: `${extensionName} ${action}`,
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

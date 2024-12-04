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
import { LanguagePlugin } from './language-plugin';
import { CppLanguagePlugin } from './plugins/cpp-language-plugin';
import { GoLanguagePlugin } from './plugins/go-language-plugin';
import { PythonLanguagePlugin } from './plugins/python-language-plugin';
import { BazelEnvironment } from '../models/bazel-environment';
import { BazelService } from '../services/bazel-service';
import * as vscode from 'vscode';


export class LanguageRegistry {
    private static plugins: { [language: string]: LanguagePlugin } = {};

    static registerPlugin(plugin: LanguagePlugin) {
        for (const language of plugin.supportedLanguages) {
            if (this.plugins[language]) {
                throw new Error(`Language plugin for '${language}' is already registered.`);
            }
            this.plugins[language] = plugin;
        }
    }

    static getPlugin(language: string | undefined): LanguagePlugin {
        if (!language || !this.plugins[language]) {
            throw new Error(`No language support for ${language}`);
        }
        return this.plugins[language];
    }

    static getLanguages(): string[] {
        return Object.keys(this.plugins);
    }
}

export function registerLanguages(context: vscode.ExtensionContext,
    bazelService: BazelService,
    bazelEnvironment: BazelEnvironment) {

    LanguageRegistry.registerPlugin(new CppLanguagePlugin(context, bazelService, bazelEnvironment.getEnvVars()));
    LanguageRegistry.registerPlugin(new GoLanguagePlugin(context, bazelService, bazelEnvironment.getEnvVars()));
    LanguageRegistry.registerPlugin(new PythonLanguagePlugin(context, bazelService, bazelEnvironment.getEnvVars()));
}

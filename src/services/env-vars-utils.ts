/////////////////////////////////////////////////////////////////////////////////////////
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
/////////////////////////////////////////////////////////////////////////////////////////

export class EnvVarsUtils {
    public static listToArray(envVars: string[]): Array<{ [key: string]: string }> {
        const vars: Array<{[key: string]: string}> = [];
        const set = envVars;
        set.forEach((item, index) => {
            const [key, value] = item.split('=');
            const nameValuePair = {
                name: key,
                value: value
            };
            vars.push(nameValuePair);
        });
        return vars;
    }

    public static listToObject(envVars: string[]): {[key: string]: string} {
        const envVariables: { [key: string]: string } = {};
        const set = envVars;
        set.forEach((item, index) => {
            const [key, value] = item.split('=');
            envVariables[key] = value;
        });

        return envVariables;
    }

    public static toBuildEnvVars(envVars: string[]): string {
        let vars = '';
        const set = envVars;
        set.forEach((value, index) => {
            vars += `--action_env=${value} `;
        });
        return vars;
    }

    public toRunEnvVars(envVars: string[]): string {
        let vars = '';
        const set = envVars;
        set.forEach((value, index) => {
            vars += `export ${value} && `;
        });

        return vars;
    }

    public toTestEnvVars(envVars: string[]): string {
        let vars = '';
        const set = envVars;
        set.forEach((value, index) => {
            vars += `--test_env=${value} `;
        });
        return vars;
    }
}
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

export class EnvVarsUtils {
    /**
     * Converts a list of environement variables into a list of objects.
     * @param envVars A list of environment variables in the form of ['A=first', 'B=second', ...].
     * @returns A list of objects in the form of [{name: 'A', value: 'first}, {name: 'B', value: 'second'}, ...].
     */
    public static listToArrayOfObjects(envVars: string[]): Array<{ [key: string]: string }> {
        const vars: Array<{[key: string]: string}> = [];
        const set = envVars;
        set.forEach((item) => {
            const [key, value] = item.split('=');
            const nameValuePair = {
                name: key,
                value: value
            };
            vars.push(nameValuePair);
        });
        return vars;
    }

    /**
     * Converts a list of environment variables into an object literal or a map.
     * @param envVars A list of environment variables in the form of ['A=first', 'B=second', ...].
     * @returns An object literal or map in the form of {A: 'first', B: 'second', ...}.
     */
    public static listToObject(envVars: string[]): {[key: string]: string} {
        const envVariables: { [key: string]: string } = {};
        const set = envVars;
        set.forEach((item) => {
            const [key, value] = item.split('=');
            envVariables[key] = value;
        });

        return envVariables;
    }

    /**
     * Converts a list of environment variables into bazel speific build environment variables.
     * @param envVars A list of environment variables in the form of ['A=first', 'B=second', ...].
     * @returns A concatenated string of all the environment variables suitable for bazel build args
     * in the form of '--action_env=A=first --action_env=B=second --action_env=...'.
     */
    public static toBuildEnvVars(envVars: string[]): string {
        let vars = '';
        const set = envVars;
        set.forEach((value) => {
            vars += `--action_env=${value} `;
        });
        return vars;
    }

    /**
     * Converts a list of environment variables into run environment variables.
     * @param envVars A list of environment variables in the form of ['A=first', 'B=second', ...].
     * @returns A concatenated string of all the environment variables suitable for run args
     * in the form of 'export A=first && export B=second && export ...'.
     */
    public static toRunEnvVars(envVars: string[]): string {
        let vars = '';
        const set = envVars;
        set.forEach((value) => {
            vars += `export ${value} && `;
        });

        return vars;
    }

    /**
     * Converts a list of environment variables into bazel speific test environment variables.
     * @param envVars A list of environment variables in the form of ['A=first', 'B=second', ...].
     * @returns A concatenated string of all the environment variables suitable for bazel test args
     * in the form of '--test_env=A=first --test_env=B=second --test_env=...'.
     */
    public static toTestEnvVars(envVars: string[]): string {
        let vars = '';
        const set = envVars;
        set.forEach((value) => {
            vars += `--test_env=${value} `;
        });
        return vars;
    }
}
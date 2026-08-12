import { CppLanguagePlugin } from '../cpp-language-plugin';

describe('CppLanguagePlugin', () => {
    describe('getCodeLensRunRegex', () => {
        it('matches all documented main signatures', () => {
            const plugin = new CppLanguagePlugin({} as any, {} as any, []);
            const regex = plugin.getCodeLensRunRegex();

            expect('int main()').toMatch(regex);
            expect('int main(int argc, char* argv)').toMatch(regex);
            expect('int main(int argc, char** argv)').toMatch(regex);
            expect('int main(int argc, char* argv[])').toMatch(regex);
            expect('int main(int argc, char* argv[10])').toMatch(regex);
            expect('int main(int argc, char * * argv)').toMatch(regex);
            expect('void main()').toMatch(regex);
            expect('void main(int argc, char** argv)').toMatch(regex);
            expect('void main(int argc, char* argv[])').toMatch(regex);
            expect('static int main(int argc, char* argv[])').toMatch(regex);
            expect('static void main(int argc, char** argv)').toMatch(regex);
        });
    });
});

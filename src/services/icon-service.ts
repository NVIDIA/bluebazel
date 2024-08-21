import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

type IconDefinition = {
    iconPath?: string;
    fontCharacter?: string;
    fontColor?: string;
    fontSize?: string;
    fontId?: string;
};

type IconTheme = {
    iconDefinitions: { [key: string]: IconDefinition };
    fileExtensions?: { [key: string]: string };
    fileNames?: { [key: string]: string };
    languageIds?: { [key: string]: string };
};

/**
 * Service to handle icon theme parsing and retrieval.
 */
export class IconService {
    private iconTheme: IconTheme | null = null;
    private iconThemePath: string | undefined;

    constructor() {
        this.loadIconTheme();
    }

    /**
     * Load and parse the active icon theme.
     */
    private async loadIconTheme() {
        const iconThemeId = vscode.workspace.getConfiguration('workbench').get('iconTheme') as string | undefined;
        if (!iconThemeId) {
            return Promise.reject(new Error('No icon theme found'));
        }

        // Define potential paths for finding the active icon theme
        const searchPaths = [
            path.join(vscode.env.appRoot, 'extensions'), // Built-in extensions in VSCode app root
            path.join(os.homedir(), '.vscode', 'extensions'), // User's extensions folder
            path.join(os.homedir(), '.vscode-server', 'extensions'), // VSCode server for remote
            path.join(os.homedir(), '.vscode-oss', 'extensions') // OSS version of VSCode
        ];

        // Try to find the theme in each search path

        for (const searchPath of searchPaths) {
            this.iconThemePath = this.findIconThemeFile(searchPath, iconThemeId);
            if (this.iconThemePath) {
                break;
            }
        }

        if (!this.iconThemePath) {
            return Promise.reject(new Error('No icon theme path found'));
        }

        try {
            // Read and parse the icon theme JSON file
            const themeContent = await fs.promises.readFile(this.iconThemePath, 'utf-8');
            this.iconTheme = JSON.parse(themeContent) as IconTheme;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * Get the icon path for a given language.
     * @param language The language ID (e.g., 'typescript', 'javascript').
     * @returns The icon path or undefined if not found.
     */
    public getIcon(language?: string): string | undefined {
        if (!this.iconTheme) {
            return undefined;
        }

        const iconPath = path.dirname(this.iconThemePath || '');

        if (language !== undefined) {
            // Check for the language ID icon
            const iconId = this.iconTheme.languageIds?.[language];
            if (iconId && this.iconTheme.iconDefinitions[iconId]) {
                return path.join(iconPath, this.iconTheme.iconDefinitions[iconId].iconPath || '');
            }
        } else {
            // Check for the special case where language is not defined
            const folderIconId = this.iconTheme.iconDefinitions?._folder;
            if (folderIconId) {
                return path.join(iconPath, this.iconTheme.iconDefinitions['_folder'].iconPath || '');
            }
        }

        // Fallback to default file icon
        const defaultIcon = this.iconTheme.iconDefinitions['_file'];
        return path.join(iconPath, defaultIcon?.iconPath || '');
    }

    /**
     * Recursively finds the icon theme file in a given directory.
     * @param dirPath The directory to search in.
     * @param themeId The ID of the theme to look for.
     * @returns The path to the icon theme file if found, otherwise undefined.
     */
    private findIconThemeFile(dirPath: string, themeId: string): string | undefined {
        if (!fs.existsSync(dirPath)) {
            return undefined;
        }

        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);

            if (file.isDirectory()) {
                // Only continue searching if the themeId is in the directory path
                if (fullPath.includes(themeId)) {
                    const iconThemeFile = this.findIconThemeFile(fullPath, themeId);
                    if (iconThemeFile) {
                        return iconThemeFile;
                    }
                }
            } else if (
                file.isFile() &&
                file.name.includes('icon-theme') &&
                file.name.endsWith('.json')
            ) {
                return fullPath;
            }
        }
        return undefined;
    }

}

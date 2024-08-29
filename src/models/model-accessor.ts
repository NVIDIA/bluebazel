import { Model } from './model';

export class ModelAccessor {
    public static getString(model: Model): string {
        const value = model.get<string>();
        if (typeof value !== 'string') {
            return '';
        } else {
            return value;
        }
    }

    public static getWithDefault<T>(model: Model, defaultValue?: T) {
        const value = model.get<string>();
        if (value === undefined) {
            return defaultValue;
        }
        return value;
    }

    public static getStringArray(model: Model): string[] {
        const values = model.get<string[]>();
        if (!values) {
            return [];
        }
        return values;
    }
}
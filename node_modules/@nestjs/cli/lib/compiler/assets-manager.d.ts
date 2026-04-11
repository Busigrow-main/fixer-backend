import { Configuration } from '../configuration';
export declare class AssetsManager {
    private watchAssetsKeyValue;
    private watchers;
    private watcherReadyPromises;
    /**
     * Using on `nest build` to close file watch or the build process will not end.
     * Waits for all watchers to complete their initial scan before closing them,
     * ensuring all assets are copied regardless of system speed.
     */
    closeWatchers(): void;
    copyAssets(configuration: Required<Configuration>, appName: string | undefined, outDir: string, watchAssetsMode: boolean): void;
    private actionOnFile;
}

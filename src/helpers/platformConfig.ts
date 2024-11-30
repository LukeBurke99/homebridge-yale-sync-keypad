import { PlatformConfig } from 'homebridge';

export type YaleSyncKeypadPlatformConfig = PlatformConfig & {
    username?: string;
    password?: string;
    backgroundRefresh?: boolean;
    refreshInterval?: number;
}

export class YaleConfigHandler {

    /**
     * Decode the user's config file into a YaleSyncKeypadPlatformConfig object
     * @param config The config from the user
     * @returns The decoded config
     */
    static decode(config: PlatformConfig): YaleSyncKeypadPlatformConfig {
        return {
            ...config,
            username: config.username ?? '',
            password: config.password ?? '',
            backgroundRefresh: config.backgroundRefresh ?? true,
            refreshInterval: config.refreshInterval ?? 5,
        };
    };

    /**
     * Check if the config is valid by checking if all required fields are present and some restrictions are met and return an error message if not
     * @param config The YaleSyncKeypadPlatformConfig object to validate
     * @returns An error message if the config is invalid, otherwise null
     */
    static validate(config: YaleSyncKeypadPlatformConfig): string | null {
        if ((config.name?.trim().length ?? 0) === 0) {
            return 'The name is required';
        }
        if ((config.username?.trim().length ?? 0) === 0) {
            return 'The username is required';
        }
        if ((config.password?.trim().length ?? 0) === 0) {
            return 'The password is required';
        }
        if (config.backgroundRefresh && (!config.refreshInterval || config.refreshInterval < 5)) {
            return 'The refresh interval is required and must be at least 5 seconds';
        }
        return null;
    }
}

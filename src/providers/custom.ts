export class CustomProvider {
    endpoint: string;
    constructor(config: { endpoint: string }) {
        this.endpoint = config.endpoint;
    }
}

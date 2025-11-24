declare module "youtube-transcript-api" {
  interface TranscriptEntry {
    text: string;
    start?: number;
    duration?: number;
  }

  interface TranscriptResponse {
    text?: string;
    transcript?: TranscriptEntry[];
  }

  class TranscriptClient {
    ready: Promise<void>;
    constructor(AxiosOptions?: any);
    getTranscript(
      id: string,
      config?: any
    ): Promise<TranscriptEntry[] | TranscriptResponse>;
    bulkGetTranscript(ids: string[], config?: any): Promise<any>;
  }

  export default TranscriptClient;
}


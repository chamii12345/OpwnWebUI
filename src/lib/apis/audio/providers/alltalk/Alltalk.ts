import { AlltalkApi } from './AlltalkApi';
import { TTSGenerationPayload, TTSGenerationStreaming, type CurrentSettings } from './alltalkApiModel';

type PreviewVoicePayload = {
    lastVoice: string; // last voice used for previewing.
    lastUrl: string; // last URL recieved from previewing.
}

export class AllTalkConfigForm {
	url: string;
	model: string;
	speaker: string;
	deepspeed: boolean;
	lowVram: boolean;
    useStreaming: boolean;
    useNarrator: boolean;
    narratorVoice: string;

    constructor(url: string, model: string, speaker: string, deepspeed: boolean, lowVram: boolean, useStreaming: boolean, useNarrator: boolean, narratorVoice: string) {
        this.url = url;
        this.model = model;
        this.speaker = speaker;
        this.deepspeed = deepspeed;
        this.lowVram = lowVram;
        this.useStreaming = useStreaming;
        this.useNarrator = useNarrator;
        this.narratorVoice = narratorVoice;
    }
};

export class Alltalk {
    api: AlltalkApi;
    isReady: boolean = false;
    baseUrl: string = '';
    voicesList: string[] = [];
    modelList: string[] = [];
    currentVoice: string = '';
    currentModel: string = '';
    currentsSettings!: CurrentSettings;
    lastPreviewVoicePayload: PreviewVoicePayload = { lastVoice: '', lastUrl: '' };
    useDeepSpeed: boolean = false;
    useLowVRAM: boolean = false;
    useStreamingMode: boolean = false;
    useNarrator: boolean = false;
    narratorVoice: string = '';
    textNotInsideSpeaker: string = 'narrator';

    constructor(baseUrl: string = '', voicesList: string[] = []) {
        this.baseUrl = baseUrl;
        this.voicesList = voicesList;
        this.api = new AlltalkApi();
    }

    async isReadyCheck(): Promise<boolean> {
        let result: boolean = false;
        const res = await this.api.ready();
        console.log("isReadyCheck: ", res);
        result = res && res.status === 'Ready';
        if (!result) {
            console.error('Alltalk is not ready.', result);
        }
        return result;
    }

    async setup(firstLoad?: boolean): Promise<void> {
        console.log("Setting up Alltalk");
        console.log("baseUrl: ", this.baseUrl);
        if (!this.baseUrl && !firstLoad) {
            return;
        }
        this.currentsSettings = await this.getCurrentSettings();

        this.voicesList = await this.getVoices();
        if (this.voicesList.length > 0 && !this.currentVoice) {
            this.currentVoice = this.voicesList[0];
        }
        this.modelList = await this.getModels();
        this.isReady = await this.isReadyCheck();
    }

    async getVoices(): Promise<string[]> {
        let result = null;
        const res = await this.api.voices();
        result = res.voices || [];
        return result;
    }

    async getModels(): Promise<string[]>{
        let result = null;
        if (!this.currentsSettings) {
            await this.getCurrentSettings();
            this.currentModel = this.currentsSettings.current_model_loaded;
        }
        result = this.currentsSettings.models_available.map((model) => model.model_name);
        console.log("modelList: ", result);

        return result;
    }

    async getCurrentSettings(): Promise<CurrentSettings> {
        console.log("getCurrentSettings !!!!");
        const res = await this.api.currentSettings();
        this.currentModel = res.current_model_loaded;
        this.useDeepSpeed = res.deepspeed_status;
        this.useLowVRAM = res.low_vram_status;
        console.log("after getting settings: ", this);
        return res;
    }

    async getPreviewVoice(voice: string, forceReload: boolean = false): Promise<string | null>{
        voice = voice || this.currentVoice;

        let result = null;
        if (this.lastPreviewVoicePayload.lastVoice === voice && !forceReload) {
            result = this.lastPreviewVoicePayload.lastUrl;
        }
        const res = await this.api.previewVoice(voice);
        if(res && res.status === 'generate-success'){
            result = res.output_file_url;

            this.lastPreviewVoicePayload = {
                lastVoice: voice,
                lastUrl: result
            };

            const audio = new Audio(result);
            audio.play();
        }
        return result;
    }

    async toggleSpeakMessage(message: any): Promise<any> {
        let result = null;
        if(this.useStreamingMode){
            result = null;
            const genPayload: TTSGenerationStreaming = new TTSGenerationStreaming(message, this.currentVoice);
            const res = await this.api.ttsGenerateStreaming(genPayload);
            if(res && res.output_file_path && res.output_file_path.length > 0){
                result =  res.output_file_path;
            }
        }else{
            const genPayload: TTSGenerationPayload = new TTSGenerationPayload(
                message,
                undefined,
                this.currentVoice,
                this.useNarrator,
                this.narratorVoice,
                this.textNotInsideSpeaker,
                undefined, undefined, undefined,
                undefined, undefined
            );
            const res = await this.api.ttsGenerate(genPayload);
            if(res && res.status === 'generate-success'){
                result =  res.output_file_url;
            }
        }

        console.log("toggleSpeakMessage: ", result);

        return result;
    }

    getConfigPayload(): AllTalkConfigForm {
        return new AllTalkConfigForm(
            this.baseUrl,
            this.currentModel,
            this.currentVoice,
            this.useDeepSpeed,
            this.useLowVRAM,
            this.useStreamingMode,
            this.useNarrator,
            this.narratorVoice
        );
    }
}
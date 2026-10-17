type GPT_SocketState = {
    clientName: string | null
    role: 'producer' | 'observer'
}

type GPT_ModelStatus = 'idle' | 'preparing' | 'generating' | 'error'

type GPT_ModelMetrics = {
    conversationId: string | null
    status: GPT_ModelStatus
    currentTokens: number
    maxTokens: number
    promptTokens: number
    generatedTokens: number
    contextTokens: number
    contextMaxTokens: number
    tps: number
    lastUpdated: string | null
    lastError: string | null
}

type GPT_Client = {
    name: string
    displayName?: string | null
    modelId?: string | null
    profile?: string | null
    ram: GPT_RAM[]
    cpu: GPT_CPU[]
    gpu: GPT_GPU[]
    lanes?: GPT_ModelLaneMetrics[]
    power?: GPT_ModelPowerMetrics
    model: GPT_ModelMetrics
}

type GPT_RAM = {
    name: string
    load: number
}

type GPT_CPU = {
    name: string
    load: number
}

type GPT_GPU = {
    name: string
    load: number
    memoryUsedMb?: number
    memoryTotalMb?: number
    powerDrawWatts?: number
    powerLimitWatts?: number
    temperatureC?: number
}

type GPT_ModelLaneMetrics = {
    id: string
    index: number
    url: string
    model?: string
    label?: string
    tier?: 'fast' | 'strong'
    gpuIndex: number
    gpuIndices?: number[]
    gpuName: string
    gpuLoad: number
    activeRequests: number
    maxRequests: number
    queuedRequests: number
    availableRequests: number
    contextMaxTokens: number
    memoryUsedMb: number
    memoryTotalMb: number
    powerDrawWatts: number
    powerLimitWatts: number
    temperatureC: number
}

type GPT_ModelPowerMetrics = {
    totalWatts: number
    monthlyKwh: number
    sampledAt: string
}

type GPT_ChatRole = 'system' | 'user' | 'assistant'

type GPT_ChatMessage = {
    role: GPT_ChatRole
    content: string
}

type GPT_PromptRequest = {
    type: 'prompt_request'
    conversationId: string
    clientName?: string
    messages: GPT_ChatMessage[]
    maxTokens?: number
    temperature?: number
}

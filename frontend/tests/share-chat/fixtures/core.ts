export type AppStory = { id: number; prompt: string; expected: string }

export const stories: AppStory[] = [
    { id: 801, prompt: 'Make this a retainer page, but keep boundaries obvious. No payment stuff.', expected: 'retainer' },
    { id: 819, prompt: 'Legal intake page. Warnings, conflict caveat, no legal advice.', expected: 'legal' },
]
export const transparencyStories: AppStory[] = [
    { id: 821, prompt: 'Make a launch page. I need to see changes before they land.', expected: 'launch' },
    { id: 825, prompt: 'Access request instructions. No secrets.', expected: 'access' },
]
export const speedReviewStories: AppStory[] = [
    { id: 841, prompt: 'Make this not embarrassing for a studio.', expected: 'studio' },
    { id: 849, prompt: 'Access page. No passwords. Make approvals clear.', expected: 'access' },
]
export const toolFrictionStories: AppStory[] = [
    { id: 861, prompt: 'make it investor safe but not cringe', expected: 'investor' },
    { id: 878, prompt: 'restaurant site, allergies careful, no orders', expected: 'restaurant' },
]
export const contextBudgetStories: AppStory[] = [
    { id: 881, prompt: 'this is too much, make the page obvious', expected: 'obvious' },
    { id: 883, prompt: 'small clinic, but dont collect anything weird', expected: 'clinic' },
]

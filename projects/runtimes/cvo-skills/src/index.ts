/**
 * User-facing skill catalog for `@cvo/skills`.
 * Teaches agents how to help with CVO backend profiles, VMZ deployment, and Cloudflare Workers.
 */

export type SkillDelivery = 'docs-only' | 'cli-stub' | 'tool-live';

export type CvoSkillMeta = {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly skillMd: string;
    readonly delivery: SkillDelivery;
};

export const CVO_SKILLS: readonly CvoSkillMeta[] = [
    {
        id: 'cvo-application',
        name: 'cvo-application',
        description: 'Help the user deploy VMZ applications with CVO as an edge backend — Workers, Pages, contract routes, and Iris transport.',
        skillMd: 'skills/cvo-application/SKILL.md',
        delivery: 'docs-only',
    },
] as const;

export function listCvoSkills(): readonly CvoSkillMeta[] {
    return CVO_SKILLS;
}

export function getCvoSkill(id: string): CvoSkillMeta | undefined {
    return CVO_SKILLS.find((s) => s.id === id);
}

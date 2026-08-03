type VersionChannel = 'alpha' | 'beta' | 'stable';

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    channel: VersionChannel;
    sequence: number;
}

function parseVersion(version: string): ParsedVersion | null {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta)(\d+))?$/.exec(version);
    if (!match) {
        return null;
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        channel: (match[4] || 'stable') as VersionChannel,
        sequence: match[5] ? Number(match[5]) : 0,
    };
}

export function compareVersions(left: string, right: string): number | null {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b) {
        return null;
    }
    for (const key of ['major', 'minor', 'patch'] as const) {
        if (a[key] !== b[key]) {
            return a[key] - b[key];
        }
    }
    const channelOrder: Record<VersionChannel, number> = { alpha: 0, beta: 1, stable: 2 };
    if (a.channel !== b.channel) {
        return channelOrder[a.channel] - channelOrder[b.channel];
    }
    return a.sequence - b.sequence;
}

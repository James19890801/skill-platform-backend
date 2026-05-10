import React from 'react';

export const AGENT_ICON_LIBRARY = Array.from({ length: 100 }, (_, index) => {
  const hue = (index * 37) % 360;
  const accent = (index * 67) % 360;
  const label = String(index + 1).padStart(2, '0');
  return {
    token: `icon:${label}`,
    label,
    background: `linear-gradient(135deg, hsl(${hue} 82% 52%), hsl(${accent} 78% 45%))`,
  };
});

export function renderAgentAvatarContent(avatar?: string, fallback?: React.ReactNode) {
  if (!avatar) return fallback;
  if (avatar.startsWith('data:image/')) {
    return undefined;
  }
  if (avatar.startsWith('icon:')) {
    return avatar.replace('icon:', '');
  }
  return fallback;
}

export function getAgentAvatarStyle(avatar?: string): React.CSSProperties {
  if (avatar?.startsWith('icon:')) {
    const item = AGENT_ICON_LIBRARY.find((icon) => icon.token === avatar);
    return {
      background: item?.background || 'linear-gradient(135deg, #2563eb, #14b8a6)',
      color: '#fff',
      fontWeight: 700,
    };
  }
  return {};
}

export function getAgentAvatarSrc(avatar?: string): string | undefined {
  return avatar?.startsWith('data:image/') ? avatar : undefined;
}

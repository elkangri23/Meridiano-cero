import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DETECTIVE_AVATARS } from '@meridiano/contracts';
import type { DetectiveAvatar, DetectiveProfileDto, SessionDto, TranslateFn } from '@meridiano/contracts';
import { profileApi } from './client';
import { useTranslation } from '../i18n';

/** Etiqueta del avatar elegido (su inicial es la que se enseña en el
 * cuadrado de la cabecera y del archivo). */
export function avatarLabel(avatar: DetectiveAvatar, t: TranslateFn): string {
  const key = DETECTIVE_AVATARS.find(entry => entry.id === avatar)?.label;
  return key ? t(key) : t('labels.avatar.detective');
}

/** Parche para guardar el perfil: si el alias queda vacío, no se toca el
 * actual (la API no admite borrarlo); el avatar siempre se envía. */
function profilePatch(alias: string, avatar: DetectiveAvatar): { alias?: string; avatar: DetectiveAvatar } {
  const trimmed = alias.trim();
  return trimmed ? { alias: trimmed, avatar } : { avatar };
}

async function saveDetectiveProfile(identity: SessionDto, alias: string, avatar: DetectiveAvatar): Promise<DetectiveProfileDto> {
  return profileApi.update(identity, profilePatch(alias, avatar), new AbortController().signal);
}

/** Resumen del perfil actual para la cabecera del formulario. */
function profileSummary(profile: DetectiveProfileDto, t: TranslateFn): string {
  const aliasNote = profile.alias === null ? t('profile.noAliasNote') : '';
  return t('profile.summary', { alias: profile.alias ?? profile.displayName, avatar: avatarLabel(profile.avatar, t), aliasNote });
}

/** Alias inicial del formulario: el del perfil, si lo hay. */
function initialAlias(profile: DetectiveProfileDto | null): string {
  return profile?.alias ?? '';
}

/** Avatar inicial del formulario: el del perfil, si lo hay. */
function initialAvatar(profile: DetectiveProfileDto | null): DetectiveAvatar {
  return profile?.avatar ?? 'detective';
}

/** Perfil de detective (§13): alias y avatar. El alias es el nombre que se
 * enseña donde hoy sale el nombre del detective; si el campo queda vacío al
 * guardar, el alias actual no cambia (no hay borrado de alias en la API).
 * El avatar es una elección cerrada, sin subida de imágenes. */
export function ProfileSection({ identity, profile, onSaved }: {
  identity: SessionDto | null; profile: DetectiveProfileDto | null; onSaved: (profile: DetectiveProfileDto) => void;
}) {
  const t = useTranslation();
  const [alias, setAlias] = useState(initialAlias(profile));
  const [avatar, setAvatar] = useState<DetectiveAvatar>(initialAvatar(profile));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const disabled = !identity || saving;

  useEffect(() => {
    if (profile) { setAlias(profile.alias ?? ''); setAvatar(profile.avatar); }
  }, [profile]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!identity) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      onSaved(await saveDetectiveProfile(identity, alias, avatar));
      setMessage(t('profile.saved'));
    } catch {
      setError(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <h4>{t('profile.title')}</h4>
    {profile && <p className="profile-note">{profileSummary(profile, t)}</p>}
    <form onSubmit={event => void save(event)}>
      <label className="profile-setting"><span>{t('profile.alias')}</span>
        <input type="text" value={alias} maxLength={160} placeholder={profile?.displayName ?? t('profile.aliasPlaceholder')}
          onChange={event => setAlias(event.target.value)} disabled={disabled} />
      </label>
      <label className="profile-setting"><span>{t('profile.avatar')}</span>
        <select value={avatar} onChange={event => setAvatar(event.target.value as DetectiveAvatar)} disabled={disabled}>
          {DETECTIVE_AVATARS.map(entry => <option key={entry.id} value={entry.id}>{t(entry.label)}</option>)}
        </select>
      </label>
      <p className="profile-note">{t('profile.help')}</p>
      <p><button type="submit" disabled={disabled}>{saving ? t('profile.saving') : t('profile.save')}</button></p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  </div>;
}

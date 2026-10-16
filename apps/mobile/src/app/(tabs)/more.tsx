import { HOUSINGS, JOBS } from '@weedapp/engine';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSession } from '@/auth/session';
import { resetLocalGame } from '@/game/client';
import { useMessages } from '@/game/messages';
import { useGame, useGameState } from '@/game/store';
import { isOnline } from '@/lib/supabase';
import { Button, Muted, Screen, Tile, TileGrid } from '@/ui/components';
import { confirm } from '@/ui/confirm';
import { Sheet } from '@/ui/Sheet';

export default function MoreScreen() {
  const state = useGameState();
  const profile = useSession((s) => s.profile);
  const signOut = useSession((s) => s.signOut);
  const sync = useGame((s) => s.sync);
  const reset = useGame((s) => s.reset);
  const router = useRouter();
  const [account, setAccount] = useState(false);
  const unread = useMessages((s) => s.unread);
  if (!state) return null;

  return (
    <Screen>
      <TileGrid>
        <Tile icon="🏠" title="Immobilier" subtitle={`${HOUSINGS[state.housing].name} · ${HOUSINGS[state.housing].plantCapacity} plants`} onPress={() => router.push('/housing')} />
        <Tile icon="💼" title="Métiers" subtitle={JOBS[state.job].name} onPress={() => router.push('/jobs')} />
        <Tile icon="🏙️" title="La ville" subtitle={`Vols, gardes du corps (${state.guards}), détective`} onPress={() => router.push('/players')} />
        {isOnline && (
          <Tile
            icon="✉️"
            title="Messages"
            subtitle={unread > 0 ? `${unread} non lu(s)` : 'Messages privés'}
            count={unread}
            onPress={() => router.push('/messages')}
          />
        )}
        <Tile icon="📓" title="Journal" subtitle="Tes 50 dernières actions" onPress={() => router.push('/journal')} />
        <Tile icon="👤" title="Compte" subtitle={isOnline ? (profile?.pseudo ?? '…') : 'Mode démo'} onPress={() => setAccount(true)} />
      </TileGrid>

      <Sheet visible={account} onClose={() => setAccount(false)} title="Compte" icon="👤">
        {isOnline ? (
          <>
            <Muted>
              Connecté en tant que {profile?.pseudo ?? '…'}
              {profile && profile.role !== 'player' ? ` (${profile.role === 'admin' ? 'admin' : 'modérateur'})` : ''}
            </Muted>
            <Button
              label="Se déconnecter"
              variant="secondary"
              onPress={async () => {
                setAccount(false);
                reset();
                await signOut();
              }}
            />
          </>
        ) : (
          <>
            <Muted>Mode démo hors ligne : ta partie est enregistrée sur ce téléphone. Le chat et les vols nécessitent le serveur.</Muted>
            <Button
              label="Recommencer la partie"
              variant="danger"
              onPress={() =>
                confirm('Recommencer ?', 'Ta partie locale sera effacée.', 'Effacer', () => {
                  setAccount(false);
                  resetLocalGame();
                  void sync();
                })
              }
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

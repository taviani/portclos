import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { useSession } from '@/providers/SessionProvider';

type Props = {
  url: string;
  cacheKey: string;
  style?: StyleProp<ImageStyle>;
};

export function AuthedImage({ url, cacheKey, style }: Props) {
  const { token } = useSession();
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) return;
      try {
        const dest = new File(Paths.cache, `closing-${cacheKey}.img`);
        const file = await File.downloadFileAsync(url, dest, {
          headers: { Authorization: `Bearer ${token}` },
          idempotent: true,
        });
        if (!cancelled) setLocalUri(file.uri);
      } catch {
        if (!cancelled) setLocalUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, url, cacheKey]);

  if (!localUri) {
    return <ActivityIndicator style={styles.loader} />;
  }
  return <Image source={{ uri: localUri }} style={style} />;
}

const styles = StyleSheet.create({
  loader: {
    width: 72,
    height: 72,
  },
});

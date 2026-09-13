import { useEffect, useState } from 'react';

export default function DebugInsets() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.top = '0';
    probe.style.left = '0';
    probe.style.paddingTop = 'env(safe-area-inset-top, -1px)';
    probe.style.paddingBottom = 'env(safe-area-inset-bottom, -1px)';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const envTop = cs.paddingTop;
    const envBottom = cs.paddingBottom;
    document.body.removeChild(probe);

    const varTop = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top');
    const varBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom');

    function readNative() {
      const cs = getComputedStyle(document.documentElement);
      setInfo({
        envTop,
        envBottom,
        varTop: varTop || '(empty)',
        varBottom: varBottom || '(empty)',
        nativeTop: cs.getPropertyValue('--native-inset-top') || '(empty)',
        nativeBottom: cs.getPropertyValue('--native-inset-bottom') || '(empty)',
        innerHeight: window.innerHeight,
        docClientHeight: document.documentElement.clientHeight,
        outerHeight: window.outerHeight,
        screenHeight: window.screen.height,
        dpr: window.devicePixelRatio,
      });
    }

    readNative();
    const interval = setInterval(readNative, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!info) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 4,
        left: 4,
        right: 4,
        zIndex: 99999,
        background: 'rgba(255,0,0,0.9)',
        color: 'white',
        fontSize: 11,
        padding: 6,
        borderRadius: 6,
        fontFamily: 'monospace',
        lineHeight: 1.4,
      }}
    >
      env-top:{info.envTop} env-bottom:{info.envBottom} | var-top:{info.varTop} var-bottom:{info.varBottom} | native-top:
      {info.nativeTop} native-bottom:{info.nativeBottom}
      <br />
      innerH:{info.innerHeight} clientH:{info.docClientHeight} outerH:{info.outerHeight} screenH:{info.screenHeight} dpr:{info.dpr}
    </div>
  );
}

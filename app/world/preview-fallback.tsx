export function PreviewFallback() {
  return (
    <div className="world-message" role="status">
      <strong>3D preview unavailable</strong>
      <p>Try a browser with WebGL 2 enabled. You can still use the room and share your invitation.</p>
    </div>
  );
}

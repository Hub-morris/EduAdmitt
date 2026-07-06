export default function PageLoader({ fullScreen }) {
  return (
    <div className={`page-loader${fullScreen ? ' full-screen-loader' : ''}`}>
      <div className="spinner" />
      <style>{`
        .full-screen-loader { min-height: 100vh; }
      `}</style>
    </div>
  );
}

import React from 'react';
import './App.css';
import './fake-server';

function App() {
  const [data, setData] = React.useState("no data");
  return (
    <div className="App">
        <p>
          Test app.
        </p>
        <button onClick={async () => {
          const data = await fetch("/api/example/123?foo=bar");
          const json = await data.json();
          setData(JSON.stringify(json, null, 4));
        }}>GET</button>
      <button onClick={async () => {
        const data = await fetch("/api/example/123", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'ping' })
        });
        const json = await data.json();
        setData(JSON.stringify(json, null, 4));
      }}>POST</button>
      <div>
      <code>{data}</code>
      </div>
    </div>
  );
}

export default App;

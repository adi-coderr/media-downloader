const EXAMPLE_URLS = [
  { label: 'Me at the zoo', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
  { label: 'BEST INTROS ON YOUTUBE (Mr Beast', url: 'https://www.youtube.com/watch?v=XW1TsAVdXsw' },
  { label: 'Lol', url: 'https://youtube.com/shorts/mkN5pblyBoU?si=oQqqUc6wdxBLjwgc' },
];

interface ExampleUrlsProps {
  onSelect: (url: string) => void;
}

export function ExampleUrls({ onSelect }: ExampleUrlsProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="text-white/40">Try an example:</span>
      {EXAMPLE_URLS.map((example) => (
        <button
          key={example.url}
          type="button"
          onClick={() => onSelect(example.url)}
          className="rounded-full border border-glass-border bg-white/5 px-3 py-1.5 text-white/70 transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-white"
        >
          {example.label}
        </button>
      ))}
    </div>
  );
}

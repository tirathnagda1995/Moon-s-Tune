import Image from "next/image";
export default function Scene({
  index = 0,
  alt = "",
  priority = false,
}: {
  index?: number;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <div className={`scene scene-${index}`}>
      <Image
        src="/world/preview-scenes.png"
        alt={alt}
        width={1536}
        height={1024}
        sizes="(max-width: 720px) 180vw, 90vw"
        priority={priority}
        style={{
          transform: `translate(${index % 2 ? "-75%" : "-25%"}, ${index >= 2 ? "-75%" : "-25%"})`,
        }}
      />
    </div>
  );
}

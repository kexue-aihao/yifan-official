"use client";
import {createContext, useContext, useEffect, useState, type ImgHTMLAttributes, type ReactNode} from 'react';
export type ImageMap = Partial<Record<string,string>>;
const MediaContext = createContext({images: {} as ImageMap, setImages: (_value: ImageMap) => {}});
export const useMedia = () => useContext(MediaContext);
export function useImageSource() {
  const {images} = useMedia();
  return (source: string) => {
    const slot = /^\/images\/([a-z]+)\.jpg$/.exec(source)?.[1];
    return slot && images[slot] ? images[slot]! : source;
  };
}
export default function MediaProvider({initialImages,children}: {initialImages: ImageMap; children: ReactNode}) {
  const [images,setImages] = useState(initialImages);
  useEffect(() => {document.body.style.setProperty('--image-dress', 'url("' + (images.dress || '/images/dress.jpg') + '")');},[images]);
  return <MediaContext.Provider value={{images,setImages}}>{children}</MediaContext.Provider>;
}
export function SiteImage({src='', ...props}: ImgHTMLAttributes<HTMLImageElement>) {
  const image = useImageSource();
  return <img {...props} src={typeof src === 'string' ? image(src) : src} referrerPolicy="no-referrer" />;
}

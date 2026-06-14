import Routes from 'virtual:devix-routes'
import { hydrateApp } from '@devlusoft/devix'
import Root from '/app/root.tsx'

const current = (document.currentScript as HTMLScriptElement | null)?.src
hydrateApp(Root, Routes, current)

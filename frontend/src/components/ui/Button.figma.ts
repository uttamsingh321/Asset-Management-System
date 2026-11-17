// url=https://www.figma.com/design/dEkwszJHj5PgWb2p5OHIjlPeN/Button?node-id=0:1
// source=src/components/ui/button.tsx
// component=Button
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const variant = instance.getEnum('Variant', {
  'Default': 'default',
  'Destructive': 'destructive',
  'Outline': 'outline',
  'Secondary': 'secondary',
  'Ghost': 'ghost',
  'Link': 'link',
})
const size = instance.getEnum('Size', {
  'Default': 'default',
  'Small': 'sm',
  'Large': 'lg',
  'Icon': 'icon',
})
const disabled = instance.getBoolean('Disabled')

export default {
  example: figma.code`
    <Button
      variant="${variant}"
      size="${size}"
      ${disabled ? 'disabled' : ''}
    >
      ${label}
    </Button>
  `,
  imports: ['import { Button } from "@/components/ui/button"'],
  id: 'button',
  metadata: { nestable: true }
}

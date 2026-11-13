import { AddAssetPanel } from './AddAssetPanel'
import type { Asset } from '@/types/asset'

interface AddAssetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddAsset: (asset: Asset) => void
}

export function AddAssetModal({
  open,
  onOpenChange,
  onAddAsset,
}: AddAssetModalProps) {
  return (
    <AddAssetPanel
      open={open}
      onClose={() => onOpenChange(false)}
      onSave={onAddAsset}
    />
  )
}

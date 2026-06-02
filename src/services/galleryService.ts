import { notFound } from "../errors/index.js";
import {
  createGalleryImage,
  deleteGalleryImage,
  listGalleryImagesInBarbershop,
  updateGalleryImage,
} from "../repository/galleryRepository.js";

/* ── helpers ── */

function serialize(img: any) {
  return {
    id: img.id,
    barbershopId: img.barbershop_id,
    url: img.url,
    alt: img.alt,
    sortOrder: img.sort_order,
    createdAt: img.created_at,
  };
}

/* ───── LIST ───── */
export async function listGalleryService(params: { barbershopId: string }) {
  const items = await listGalleryImagesInBarbershop(params.barbershopId);
  return items.map(serialize);
}

/* ───── CREATE ───── */
export async function createGalleryImageService(params: {
  barbershopId: string;
  data: {
    url: string;
    alt?: string | null;
    sortOrder?: number;
  };
}) {
  const created = await createGalleryImage({
    barbershopId: params.barbershopId,
    ...params.data,
  });
  return serialize(created);
}

/* ───── DELETE ───── */
export async function deleteGalleryImageService(params: {
  barbershopId: string;
  imageId: string;
}) {
  const deleted = await deleteGalleryImage(params.barbershopId, params.imageId);
  if (!deleted) throw notFound("Imagem não encontrada");
  return { message: "Imagem removida com sucesso" };
}

/* ───── UPDATE ───── */
export async function updateGalleryImageService(params: {
  barbershopId: string;
  imageId: string;
  data: {
    url?: string;
    alt?: string | null;
    sortOrder?: number;
  };
}) {
  const updated = await updateGalleryImage(
    params.barbershopId,
    params.imageId,
    params.data
  );
  if (!updated) throw notFound("Imagem não encontrada");
  return {
    id: updated.id,
    barbershopId: updated.barbershop_id,
    url: updated.url,
    alt: updated.alt,
    sortOrder: updated.sort_order,
    createdAt: updated.created_at,
  };
}

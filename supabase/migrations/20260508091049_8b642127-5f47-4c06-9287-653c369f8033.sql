
REVOKE ALL ON FUNCTION public.purchase_shop_item(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid, text) TO authenticated;

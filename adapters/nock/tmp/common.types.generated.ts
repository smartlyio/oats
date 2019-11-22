/* tslint:disable variable-name only-arrow-functions*/
import * as oar from "@smartlyio/oats-runtime";
enum BrandOfItemId {
}
export type ItemId = oar.valueClass.Branded<string, BrandOfItemId>;
export type ShapeOfItemId = string;
export const makeItemId: oar.make.Maker<ShapeOfItemId, ItemId> = oar.make.createMaker(function () { return oar.make.makeString(); });
export interface ShapeOfItem {
    readonly id: ShapeOfItemId;
    readonly name: string;
    readonly [key: string]: unknown;
}
enum BrandOfItem {
}
export class Item extends oar.valueClass.ValueClass<ShapeOfItem, BrandOfItem> implements ShapeOfItem {
    readonly id!: ItemId;
    readonly name!: string;
    readonly [instanceIndexSignatureKey: string]: unknown;
    public constructor(value: ShapeOfItem, opts?: oar.make.MakeOptions) { super(); Object.assign(this, buildItem(value, opts).success()); }
    static make(value: ShapeOfItem, opts?: oar.make.MakeOptions): oar.make.Make<Item> { return makeItem(value, opts); }
}
export const buildItem: oar.make.Maker<ShapeOfItem, ShapeOfItem> = oar.make.createMaker(function () { return oar.make.makeObject({
    id: makeItemId,
    name: oar.make.makeString()
}, oar.make.makeAny()); });
export const makeItem: oar.make.Maker<ShapeOfItem, Item> = oar.make.createMakerWith(Item);

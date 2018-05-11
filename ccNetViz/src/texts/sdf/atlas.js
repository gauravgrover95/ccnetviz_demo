'use strict';

import ShelfPack from 'shelf-pack';
//import util from '../util/util';

const SIZE_GROWTH_RATE = 4;
const DEFAULT_SIZE = 1024;
// must be "DEFAULT_SIZE * SIZE_GROWTH_RATE ^ n" for some integer n
const MAX_SIZE = 2048;

export default class GlyphAtlas {

    constructor(gl, resetCache) {
        this.width = DEFAULT_SIZE;
        this.height = DEFAULT_SIZE;

        this._resetCache = resetCache;
        this.bin = new ShelfPack(this.width, this.height);
        this.index = {};
        this.ids = {};
      
        this.gl = gl;
        this.data = new Uint8Array(this.width * this.height);
        
        
    }
    
    _createTexture(){
        this.dirty = false;
        let gl = this.gl;
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, this.width, this.height, 0, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    getGlyphs() {
        const glyphs = {};
        let split,
            name,
            id;

        for (const key in this.ids) {
            split = key.split('#');
            name = split[0];
            id = split[1];

            if (!glyphs[name]) glyphs[name] = [];
            glyphs[name].push(id);
        }

        return glyphs;
    }

    getRects() {
        const rects = {};
        let split,
            name,
            id;

        for (const key in this.ids) {
            split = key.split('#');
            name = split[0];
            id = split[1];

            if (!rects[name]) rects[name] = {};
            rects[name][id] = this.index[key];
        }

        return rects;
    }

    addGlyph(id, name, glyph, buffer, markDirty) {
        if (!glyph) return null;

        const key = `${name}#${glyph.id}`;

        // The glyph is already in this texture.
        if (this.index[key]) {
            if (this.ids[key].indexOf(id) < 0) {
                this.ids[key].push(id);
            }
            return this.index[key];
        }

        const bufferedWidth = glyph.width + buffer * 2;
        const bufferedHeight = glyph.height + buffer * 2;

        // Add a 1px border around every image.
        const padding = 1;
        let packWidth = bufferedWidth + 2 * padding;
        let packHeight = bufferedHeight + 2 * padding;

        // Increase to next number divisible by 4, but at least 1.
        // This is so we can scale down the texture coordinates and pack them
        // into fewer bytes.
        packWidth += (4 - packWidth % 4);
        packHeight += (4 - packHeight % 4);

        let rect = this.bin.packOne(packWidth, packHeight);
        if (!rect) {
            this.resize();
            rect = this.bin.packOne(packWidth, packHeight);
            markDirty && markDirty();
        }
        if (!rect) {
            return null;
        }

        this.index[key] = rect;
        this.ids[key] = [id];

        if (glyph.bitmap) {
          const target = this.data;
          const source = glyph.bitmap;
          for (let y = 0; y < bufferedHeight; y++) {
              const y1 = this.width * (rect.y + y + padding) + rect.x + padding;
              const y2 = bufferedWidth * y;
              for (let x = 0; x < bufferedWidth; x++) {
                  target[y1 + x] = source[y2 + x];
              }
          }
        }
          
        this.dirty = true;

        return rect;
    }

    resize() {
        const prevWidth = this.width;
        const prevHeight = this.height;

        if (prevWidth >= MAX_SIZE || prevHeight >= MAX_SIZE) return;

        if (this._texture) {
            if (this.gl) {
                this.gl.deleteTexture(this._texture);
            }
            this._texture = null;
        }

        this.width *= SIZE_GROWTH_RATE;
        this.height *= SIZE_GROWTH_RATE;
        this.bin.resize(this.width, this.height);

        const buf = new ArrayBuffer(this.width * this.height);
        for (let i = 0; i < prevHeight; i++) {
            const src = new Uint8Array(this.data.buffer, prevHeight * i, prevWidth);
            const dst = new Uint8Array(buf, prevHeight * i * SIZE_GROWTH_RATE, prevWidth);
            dst.set(src);
        }
        this.data = new Uint8Array(buf);
        this._resetCache();
    }

    bind(gl) {
    }
    
    get texture(){
        return this._texture;
    }

    updateTexture() {
        let gl = this.gl;
        if (!this._texture) {
            this._texture = this._createTexture();
        }
        if(this.dirty){
            gl.bindTexture(gl.TEXTURE_2D, this._texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);
            gl.bindTexture(gl.TEXTURE_2D, null);
            this.dirty = false;
        }
        return this._texture;
    }
};
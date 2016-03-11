// stolen from https://github.com/SheetJS/js-xlsx/blob/53f7f6d9446ccd680c9b13992d6dcdccde49a8f6/bits/90_utils.js
// Differences:
//   decode entities
//   allow empty headers/values
//   allow empty rows, but not trailing empty rows

import entities from 'entities'

function encode_row(row) { return "" + (row + 1); }
function encode_col(col) { var s=""; for(++col; col; col=Math.floor((col-1)/26)) s = String.fromCharCode(((col-1)%26) + 65) + s; return s; }

function safe_decode_range(range) {
    var o = {s:{c:0,r:0},e:{c:0,r:0}};
    var idx = 0, i = 0, cc = 0;
    var len = range.length;
    for(idx = 0; i < len; ++i) {
        if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
        idx = 26*idx + cc;
    }
    o.s.c = --idx;

    for(idx = 0; i < len; ++i) {
        if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
        idx = 10*idx + cc;
    }
    o.s.r = --idx;

    if(i === len || range.charCodeAt(++i) === 58) { o.e.c=o.s.c; o.e.r=o.s.r; return o; }

    for(idx = 0; i != len; ++i) {
        if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
        idx = 26*idx + cc;
    }
    o.e.c = --idx;

    for(idx = 0; i != len; ++i) {
        if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
        idx = 10*idx + cc;
    }
    o.e.r = --idx;
    return o;
}

function safe_format_cell(cell, v) {
    if(cell.z !== undefined) try { return (cell.w = SSF.format(cell.z, v)); } catch(e) { }
    if(!cell.XF) return v;
    try { return (cell.w = SSF.format(cell.XF.ifmt||0, v)); } catch(e) { return ''+v; }
}

function format_cell(cell, v) {
    if(cell == null || cell.t == null) return "";
    if(cell.w !== undefined) return cell.w;
    if(v === undefined) return safe_format_cell(cell, cell.v);
    return safe_format_cell(cell, v);
}

function decode_format_cell(cell, v) {
    return entities.decodeXML(format_cell(cell, v));
}

function sheet_to_json(sheet, opts){
    var val, row, range, header = 0, offset = 1, r, hdr = [], lasti, R, C, v;
    var o = opts != null ? opts : {};
    var raw = o.raw;
    if(sheet == null || sheet["!ref"] == null) return [];
    range = o.range !== undefined ? o.range : sheet["!ref"];
    if(o.header === 1) header = 1;
    else if(o.header === "A") header = 2;
    else if(Array.isArray(o.header)) header = 3;
    switch(typeof range) {
        case 'string': r = safe_decode_range(range); break;
        case 'number': r = safe_decode_range(sheet["!ref"]); r.s.r = range; break;
        default: r = range;
    }
    if(header > 0) offset = 0;
    var rr = encode_row(r.s.r);
    var cols = new Array(r.e.c-r.s.c+1);
    var out = new Array(r.e.r-r.s.r-offset+1);
    var outi = 0;
    for(C = r.s.c; C <= r.e.c; ++C) {
        cols[C] = encode_col(C);
        val = sheet[cols[C] + rr];
        switch(header) {
            case 1: hdr[C] = C; break;
            case 2: hdr[C] = cols[C]; break;
            case 3: hdr[C] = o.header[C - r.s.c]; break;
            default:
                hdr[C] = decode_format_cell(val);
        }
    }

    for (R = r.s.r + offset; R <= r.e.r; ++R) {
        rr = encode_row(R);
        if(header === 1) row = [];
        else {
            row = {};
            if(Object.defineProperty) Object.defineProperty(row, '__rowNum__', {value:R, enumerable:false});
            else row.__rowNum__ = R;
        }
        for (C = r.s.c; C <= r.e.c; ++C) {
            val = sheet[cols[C] + rr];
            if(val === undefined || val.t === undefined) {
                row[hdr[C]] = '';
            } else {
                v = val.v;
                switch(val.t){
                    case 'e': continue;
                    case 's': break;
                    case 'b': case 'n': break;
                    default: throw 'unrecognized type ' + val.t;
                }
                row[hdr[C]] = raw ? v : decode_format_cell(val,v);
                if (v !== undefined) {
                    lasti = outi;
                }
            }
        }
        out[outi++] = row;
    }
    out.length = lasti + 1;
    return out;
}

export default sheet_to_json;

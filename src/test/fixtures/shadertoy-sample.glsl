// A single-pass shader written the way Shadertoy shaders are: one mainImage,
// the i* inputs, integer literals in constructors, and no textures. Kept in
// the repo to check that a shader pasted in whole compiles and runs.
#define TAU 6.2831853
#define ARMS 5

mat2 rotate(float angle)
{
    float c = cos(angle), s = sin(angle);
    return mat2(c, -s, s, c);
}

vec3 palette(float t)
{
    return 0.5 + 0.5 * cos(TAU * (t + vec3(0, 0.33, 0.67)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
    vec2 mouse = iMouse.z > 0.0
        ? (iMouse.xy * 2.0 - iResolution.xy) / iResolution.y
        : vec2(0);
    uv = rotate(iTime * 0.2) * (uv - mouse);

    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    vec3 col = vec3(0);
    for (int i = 1; i <= ARMS; i++)
    {
        float wave = sin(radius * 14.0 - iTime * 2.0 + float(i) * angle);
        float band = smoothstep(0.7, 1.0, wave);
        col += palette(float(i) / float(ARMS) + radius * 0.5) * band;
    }
    col /= 1.0 + radius * radius;

    fragColor = vec4(col, 1.0);
}
